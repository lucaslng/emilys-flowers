// WCAG 2.2 AA automated scan + keyboard verification (issue #114).
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
 * Reduced motion is forced via playwright.config.ts contextOptions, and the
 * reduced-motion CSS guard in globals.css renders .page-enter and every
 * reveal (.reveal-init / [data-reveal]) at full opacity immediately (SSR HTML
 * included) — Reveal.tsx takes its early-return path and never registers
 * ScrollTrigger reveals. So no scroll-settling or animation polling is needed
 * before a scan; just wait for the page-enter element to reach full opacity.
 */
async function settlePage(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector(".page-enter");
    return !el || getComputedStyle(el).opacity === "1";
  });
}

interface ActiveElementInfo {
  tag: string;
  text: string;
  label: string | null;
  disabled: boolean;
}

/** One keyboard focus stop, snapshotted in-page at stop time (rects change as
 *  later tabs scroll the page, so everything is captured synchronously inside
 *  the focusin handler). */
interface FocusStop {
  onBody: boolean;
  isSkipLink: boolean;
  insideNav: boolean;
  positionFixed: boolean;
  tag: string;
  text: string; // trimmed, sliced to 60
  label: string | null; // aria-label only (label fallbacks derive from text)
  disabled: boolean;
  matchesFocusVisible: boolean;
  outlineStyle: string;
  outlineWidth: string;
  rect: { top: number; bottom: number; left: number; right: number };
  navRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  } | null; // null when no <nav> in doc
}

/** Install an in-page focusin recorder so a whole Tab sequence can be
 *  inspected with one round-trip instead of one evaluate per keypress.
 *  Idempotent: the listener is installed once per document; each call just
 *  starts a fresh log so repeated sequences never accumulate stale stops. */
async function recordFocusStops(page: Page) {
  await page.evaluate(() => {
    const w = window as typeof window & {
      __focusLog?: FocusStop[];
      __focusRecorder?: () => void;
    };
    if (!w.__focusRecorder) {
      const recorder = () => {
        const el = document.activeElement as HTMLElement | null;
        const onBody = !el || el === document.body;
        const nav = document.querySelector("nav");
        const cs = onBody ? null : getComputedStyle(el);
        const er = onBody ? null : el.getBoundingClientRect();
        const nr = nav?.getBoundingClientRect() ?? null;
        (w.__focusLog ??= []).push({
          onBody,
          isSkipLink: !onBody && el.classList.contains("skip-link"),
          insideNav: !onBody && nav !== null && nav.contains(el),
          positionFixed: cs?.position === "fixed",
          tag: onBody ? "BODY" : el.tagName,
          text: onBody ? "" : (el.textContent ?? "").trim().slice(0, 60),
          label: onBody ? null : el.getAttribute("aria-label"),
          disabled:
            !onBody && el instanceof HTMLButtonElement ? el.disabled : false,
          matchesFocusVisible: !onBody && el.matches(":focus-visible"),
          outlineStyle: cs ? cs.outlineStyle : "none",
          outlineWidth: cs ? cs.outlineWidth : "0px",
          rect: er ?? { top: 0, bottom: 0, left: 0, right: 0 },
          navRect: nr
            ? {
                top: nr.top,
                bottom: nr.bottom,
                left: nr.left,
                right: nr.right,
              }
            : null,
        });
      };
      w.__focusRecorder = recorder;
      document.addEventListener("focusin", recorder, true);
    }
    w.__focusLog = [];
  });
}

async function readFocusLog(page: Page): Promise<FocusStop[]> {
  return page.evaluate(
    () =>
      (window as typeof window & { __focusLog?: FocusStop[] }).__focusLog ?? []
  );
}

function toActiveElementInfo(stop: FocusStop): ActiveElementInfo {
  return {
    tag: stop.tag,
    text: stop.text,
    label: stop.label,
    disabled: stop.disabled,
  };
}

/** Describe the currently focused element (null when focus is on <body>). */
async function getActiveElementInfo(
  page: Page
): Promise<ActiveElementInfo | null> {
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

/**
 * Press Tab until `predicate` matches a focus stop (up to `maxTabs` presses).
 * Presses are batched in chunks against the in-page focus log — one evaluate
 * per chunk instead of one per keypress; real trusted Tab events preserve
 * native focus order and scroll-into-view. Returns the matched stop's info,
 * or the last stop seen if there is no match within `maxTabs`.
 */
async function tabUntil(
  page: Page,
  predicate: (info: ActiveElementInfo) => boolean,
  maxTabs = 60
): Promise<ActiveElementInfo | null> {
  const CHUNK = 10;
  await recordFocusStops(page);
  let pressed = 0;
  let prevStops = 0;
  let lastSeen: ActiveElementInfo | null = null;
  while (pressed < maxTabs) {
    const size = Math.min(CHUNK, maxTabs - pressed);
    for (let i = 0; i < size; i++) await page.keyboard.press("Tab");
    pressed += size;
    const stops = (await readFocusLog(page)).filter((stop) => !stop.onBody);
    const infos = stops.map(toActiveElementInfo);
    const idx = infos.findIndex((info) => predicate(info));
    if (idx !== -1) {
      // Real Tabs moved focus sequentially, so live focus sits on the chunk's
      // last stop. If every press in this chunk landed on a page element
      // (stop count grew by exactly `size`), walking back that many stops
      // with real Shift+Tab events is exact. Otherwise a press fell into
      // browser chrome; fall back to verified stepping until live focus
      // satisfies the predicate again.
      if (stops.length - prevStops === size) {
        for (let i = 0; i < stops.length - 1 - idx; i++) {
          await page.keyboard.press("Shift+Tab");
        }
      } else {
        for (let i = 0; i <= size; i++) {
          await page.keyboard.press("Shift+Tab");
          const here = await getActiveElementInfo(page);
          if (here && predicate(here)) break;
        }
      }
      return infos[idx];
    }
    lastSeen = infos.at(-1) ?? lastSeen;
    prevStops = stops.length;
  }
  return lastSeen;
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
          items: [
            {
              name: "Aurora Bloom",
              image: "/products/green-evangeline/01-main.jpg",
              quantity: 2,
              unitAmount: 7999,
            },
          ],
          subtotal: 15998,
          shipping: 0,
          total: 15998,
          orderNumber: "EF-TEST",
        }),
      })
    );
    await page.goto(
      `/checkout/success?order=EF-TEST&session_id=cs_test_123`
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
    // Tabs are batched through the in-page focus log; stops are inspected in
    // order afterwards (snapshots were captured at stop time).
    const focusFailures: string[] = [];
    await recordFocusStops(page);
    for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
    for (const stop of await readFocusLog(page)) {
      if (stop.onBody) break;
      if (!stop.matchesFocusVisible && stop.outlineStyle === "none") {
        const label = stop.label ?? stop.text.slice(0, 40);
        focusFailures.push(
          `${stop.tag} "${label}" has no focus indicator (:focus-visible=${stop.matchesFocusVisible}, outline=${stop.outlineStyle} ${stop.outlineWidth})`
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
    // manually: at each focus stop, the focused element's bounding box must
    // not overlap the sticky nav's bounding box (a focus scrolled under the
    // nav would be hidden). Bounded to the first several focus stops; tabs
    // are batched through the in-page focus log (snapshots at stop time).
    await page.goto("/");

    const failures: string[] = [];
    await recordFocusStops(page);
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    for (const stop of await readFocusLog(page)) {
      if (stop.onBody) continue;
      // The skip link is intentionally position: fixed above the nav
      // (globals.css); elements inside the navbar are, by definition,
      // rendered within it.
      if (
        stop.isSkipLink ||
        stop.insideNav ||
        stop.positionFixed ||
        stop.navRect === null
      ) {
        continue;
      }
      const nr = stop.navRect;
      const er = stop.rect;
      const overlaps =
        er.left < nr.right && er.right > nr.left && er.top < nr.bottom && er.bottom > nr.top;
      if (overlaps) {
        const label = stop.label ?? stop.text.slice(0, 40);
        failures.push(
          `${stop.tag} "${label}" overlaps the sticky nav ` +
            `(nav ${JSON.stringify({ top: nr.top, bottom: nr.bottom })} ` +
            `vs element ${JSON.stringify(er)})`
        );
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
