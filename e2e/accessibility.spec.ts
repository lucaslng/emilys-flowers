// e2e/accessibility.spec.ts
//
// WCAG 2.2 AA automated scan + keyboard verification (issue #114).
//
// Automated scanning uses @axe-core/playwright with the five AA tags. Note that
// axe-core's `target-size` rule (SC 2.5.8) is shipped `enabled: false`, so it
// is not part of a tag run — the five tags are still passed exactly as
// specified so the tag selection matches the AA conformance set (tags are not
// cumulative, and AA conformance includes Level A). axe-core has NO rule for
// SC 2.4.11 (Focus Not Obscured), so that criterion is verified manually in
// "focused elements are not obscured by the sticky nav" below.

import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
}

/**
 * Wait for the page to be scan-ready:
 * 1. The `template.tsx` page-enter animation (300ms) so the whole page is fully
 *    opaque (axe color-contrast checks on mid-fade content would be false
 *    positives).
 * 2. Fire every ScrollTrigger reveal by scrolling through the page.
 * 3. Wait for every reveal (including staggered children) to settle at
 *    opacity 1, so axe never samples an element mid-transition.
 */
async function settlePage(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector(".page-enter");
    return !el || getComputedStyle(el).opacity === "1";
  });

  // Trigger all ScrollTrigger reveals by scrolling down in steps with pauses
  // (a single instant jump to the bottom misses mid-page reveals), then
  // return to the top so the page is in a scannable state.
  await page.evaluate(async () => {
    const height = document.body.scrollHeight;
    const step = Math.max(window.innerHeight, 200);
    for (let y = 0; y <= height; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 120));
  });

  await page.waitForFunction(
    () => {
      const roots = Array.from(
        document.querySelectorAll(".reveal-init, [data-reveal]")
      );
      if (roots.length === 0) return true;
      // Stagger reveals animate the root's direct children (product cards,
      // reason rows, cart items), so check both the roots and their children.
      const targets: Element[] = [];
      for (const root of roots) {
        targets.push(root);
        targets.push(...Array.from(root.children));
      }
      return targets.every((el) => getComputedStyle(el).opacity === "1");
    },
    { timeout: 5_000 }
  );
}

interface ActiveElementInfo {
  tag: string;
  text: string;
  label: string | null;
  disabled: boolean;
}

/** Describe the currently focused element (null when focus is on <body>). */
async function getActiveElementInfo(page: Page): Promise<ActiveElementInfo | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName,
      text: (el.textContent ?? "").trim().slice(0, 60),
      label: el.getAttribute("aria-label"),
      disabled: el instanceof HTMLButtonElement ? el.disabled : false,
    };
  });
}

/** Press Tab up to `maxTabs` times until `predicate` matches the focused
 *  element; returns the focused element info (last one seen on timeout). */
async function tabUntil(
  page: Page,
  predicate: (info: ActiveElementInfo) => boolean,
  maxTabs = 60
): Promise<ActiveElementInfo | null> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const info = await getActiveElementInfo(page);
    if (info && predicate(info)) return info;
  }
  return getActiveElementInfo(page);
}

test.describe("WCAG 2.2 AA automated scans", () => {
  for (const route of [
    { name: "home", path: "/" },
    { name: "flowers", path: "/flowers" },
    { name: "bouquets", path: "/bouquets" },
  ]) {
    test(`all public routes: ${route.name} has no WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(route.path);
      await settlePage(page);
      const results = await scan(page);
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }

  test("a product page has no WCAG 2.2 AA violations", async ({ page }) => {
    await page.goto("/flowers");
    await expect(page.locator("h1")).toContainText("Individual Flowers");

    // Grab the first product's link so the scan runs against a real catalog item.
    const firstProductHref = await page
      .locator('a[href^="/products/"]')
      .first()
      .getAttribute("href");
    expect(firstProductHref, "expected at least one product link on /flowers").toBeTruthy();

    await page.goto(firstProductHref!);
    await expect(page.locator("h1")).toBeVisible();
    await settlePage(page);

    const results = await scan(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("cart page with items has no WCAG 2.2 AA violations", async ({ page }) => {
    // Seed the cart through the real UI so the line-item controls (remove,
    // quantity buttons) and the order summary are all part of the scan.
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await expect(page.locator("#cart-icon span")).toContainText("1");

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();
    await settlePage(page);

    const results = await scan(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("checkout page with a populated cart has no WCAG 2.2 AA violations", async ({ page }) => {
    // Same seeding as the cart scan so the full checkout (order summary +
    // "Pay with Stripe") is covered, not just the empty-cart state.
    await page.goto("/bouquets");
    await page.getByRole("button", { name: "Add to Cart" }).first().click();
    await expect(page.locator("#cart-icon span")).toContainText("1");

    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: "Pay with Stripe" })).toBeVisible();
    await settlePage(page);

    const results = await scan(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("checkout success page (real success state) has no WCAG 2.2 AA violations", async ({ page }) => {
    // Intercept receipt retrieval; scan the real session_id-only success URL.
    await page.route(/\/api\/checkout\/session/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [{ name: "Aurora Bloom", quantity: 2, unitAmount: 7999 }],
          subtotal: 15998,
          shipping: 0,
          total: 15998,
          orderNumber: "EF-TEST",
        }),
      })
    );
    await page.goto(
      `/checkout/success?success=true&order=EF-TEST&session_id=cs_test_123`
    );

    // The success page mounts its content client-side inside <Suspense>.
    await expect(page.getByRole("heading", { name: "Thank you for your order" })).toBeVisible();
    await settlePage(page);

    const results = await scan(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});

test.describe("Mobile nav menu accessibility", () => {
  test("mobile nav menu is accessible when open", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await settlePage(page);

    const toggle = page.getByRole("button", { name: "Toggle navigation menu" });
    await expect(toggle).toBeVisible();
    await toggle.click();

    // The menu opens and focus moves to its first link (Navbar's focus management).
    const menu = page.locator("#mobile-nav-menu");
    await expect(menu).toBeVisible();
    await expect(page.getByRole("link", { name: "Home", exact: true }).last()).toBeFocused();

    const results = await scan(page);
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

    // Escape closes the menu and returns focus to the toggle.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(toggle).toBeFocused();
  });

  test("nav toggle exposes aria-expanded and aria-controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "Toggle navigation menu" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "mobile-nav-menu");

    // aria-controls must point at a real element once the menu is open.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const controlsId = await toggle.getAttribute("aria-controls");
    expect(controlsId).toBe("mobile-nav-menu");
    await expect(page.locator(`#${controlsId}`)).toHaveCount(1);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(`#${controlsId}`)).toHaveCount(0);
  });
});

test.describe("Keyboard-only flow (WCAG 2.1.1)", () => {
  test("browse → filter → add to cart → cart → checkout works with the keyboard only", async ({ page }) => {
    // ── Skip link (WCAG 2.4.1): first tab stop, then jumps to #main.
    await page.goto("/");
    const skipLink = page.locator("a.skip-link");
    await expect(skipLink).toBeAttached();

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      if (await skipLink.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(skipLink).toBeFocused();
    // The focused skip link is re-positioned fixed at top-left (globals.css).
    await expect(skipLink).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main/);

    // ── Focus indicator (WCAG 2.4.7): every focus stop must be visibly focused.
    const focusFailures: string[] = [];
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return {
          matchesFocusVisible: el.matches(":focus-visible"),
          outlineStyle: cs.outlineStyle,
          outlineWidth: cs.outlineWidth,
          tag: el.tagName,
          label: el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 40),
        };
      });
      if (!info) break;
      if (!info.matchesFocusVisible && info.outlineStyle === "none") {
        focusFailures.push(
          `${info.tag} "${info.label}" has no focus indicator (:focus-visible=${info.matchesFocusVisible}, outline=${info.outlineStyle} ${info.outlineWidth})`
        );
      }
    }
    expect(focusFailures, focusFailures.join("\n")).toEqual([]);

    // ── Filter (keyboard): raise the "Minimum price" slider by one step.
    await page.goto("/bouquets");
    const minPriceInfo = await tabUntil(
      page,
      (info) => info.tag === "INPUT" && info.label === "Minimum price"
    );
    expect(minPriceInfo, "could not tab to the Minimum price filter on /bouquets").toMatchObject({
      tag: "INPUT",
      label: "Minimum price",
    });
    const priceBefore = await page.evaluate(
      () => (document.activeElement as HTMLInputElement).value
    );
    await page.keyboard.press("ArrowRight");
    const priceAfter = await page.evaluate(
      () => (document.activeElement as HTMLInputElement).value
    );
    expect(
      Number(priceAfter),
      "ArrowRight on the focused price slider should raise the minimum price"
    ).toBeGreaterThan(Number(priceBefore));
    // Restore the original minimum so the next step tabs through the full grid.
    await page.keyboard.press("ArrowLeft");

    // ── Add to cart: Tab to an enabled "Add to Cart" button and press Enter.
    const addInfo = await tabUntil(
      page,
      (info) => info.tag === "BUTTON" && !info.disabled && info.text === "Add to Cart"
    );
    expect(addInfo, "could not tab to an enabled Add to Cart button on /bouquets").toMatchObject({
      tag: "BUTTON",
      text: "Add to Cart",
    });
    await page.keyboard.press("Enter");
    await expect(page.locator("#cart-icon span")).toContainText("1");

    // ── Cart → Checkout: Tab to "Proceed to Checkout" and press Enter.
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Order Summary" })).toBeVisible();
    const checkoutInfo = await tabUntil(page, (info) => info.text.includes("Proceed to Checkout"));
    expect(checkoutInfo, "could not tab to Proceed to Checkout on /cart").toMatchObject({
      tag: "A",
    });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/checkout$/);
  });
});

test.describe("Focus not obscured by sticky nav (WCAG 2.4.11, manual check)", () => {
  test("focused elements are not scrolled under the sticky navbar", async ({ page }) => {
    // axe-core has no rule for SC 2.4.11 (Focus Not Obscured), so check it
    // manually: after each Tab, the focused element's bounding box must not
    // overlap the sticky nav's bounding box (a focus scrolled under the nav
    // would be hidden). Bounded to the first several focus stops.
    await page.goto("/");

    const failures: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const result = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return { ok: true, skipped: "body" };
        // The skip link is intentionally position: fixed above the nav (globals.css).
        if (el.classList.contains("skip-link")) return { ok: true, skipped: "skip-link" };
        const nav = document.querySelector("nav");
        if (!nav) return { ok: true, skipped: "no-nav" };
        // Elements inside the navbar are, by definition, rendered within it.
        if (nav.contains(el)) return { ok: true, skipped: "inside-nav" };
        if (getComputedStyle(el).position === "fixed") {
          return { ok: true, skipped: "fixed" };
        }
        const nr = nav.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const overlaps =
          er.left < nr.right && er.right > nr.left && er.top < nr.bottom && er.bottom > nr.top;
        return {
          ok: !overlaps,
          tag: el.tagName,
          label: el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 40),
          navRect: { top: nr.top, bottom: nr.bottom },
          elRect: { top: er.top, bottom: er.bottom, left: er.left, right: er.right },
        };
      });
      if (result && !result.ok) {
        failures.push(
          `${result.tag} "${result.label}" overlaps the sticky nav ` +
            `(nav ${JSON.stringify(result.navRect)} vs element ${JSON.stringify(result.elRect)})`
        );
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
