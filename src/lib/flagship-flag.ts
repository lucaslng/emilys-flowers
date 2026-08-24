import https from "node:https";

export const UNDER_CONSTRUCTION_FLAG_KEY = "under-construction";
export const FLOWERS_FLAG_KEY = "enable-flowers-page";

export function flagshipEvaluateUrl(
  accountId: string,
  appId: string,
  flagKey: string
): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/flagship/apps/${appId}/evaluate?flagKey=${flagKey}`;
}

// Shared parser: fail-closed flags (fallback false) require an explicit true;
// fail-open flags (fallback true) require an explicit false to disable.
function flagValueFromEvaluateResponse(data: unknown, fallback: boolean): boolean {
  if (typeof data !== "object" || data === null) return fallback;
  const value = (data as { value?: unknown }).value;
  return fallback ? value !== false : value === true;
}

export function underConstructionFromEvaluateResponse(data: unknown): boolean {
  return flagValueFromEvaluateResponse(data, false);
}

export function flowersEnabledFromEvaluateResponse(data: unknown): boolean {
  return flagValueFromEvaluateResponse(data, true);
}

// Use `https`, not `fetch`, so Next.js's Data Cache never serves a stale
// flag value from a previous build.
async function requestFlag(
  url: string,
  apiToken: string,
  fallback: boolean
): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Accept-Encoding": "identity",
        },
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) return resolve(fallback);
          try {
            resolve(flagValueFromEvaluateResponse(JSON.parse(body), fallback));
          } catch {
            resolve(fallback);
          }
        });
      }
    );
    req.on("error", () => resolve(fallback));
    req.on("timeout", () => {
      req.destroy();
      resolve(fallback);
    });
  });
}

// Called once per build from next.config.ts. Any failure (missing credentials,
// non-200, malformed payload, network error, timeout) resolves to `fallback`.
async function evaluateFlag(flagKey: string, fallback: boolean): Promise<boolean> {
  const appId = process.env.FLAGSHIP_APP_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!appId || !accountId || !apiToken) return fallback;

  return requestFlag(flagshipEvaluateUrl(accountId, appId, flagKey), apiToken, fallback);
}

// Only the production build honors the flag: deploy.yml sets
// UNDER_CONSTRUCTION_ENABLED there, and preview/dev builds skip evaluation
// so previews always render the store, never the construction screen.
export async function evaluateUnderConstruction(): Promise<boolean> {
  if (process.env.UNDER_CONSTRUCTION_ENABLED !== "true") return false;
  // Fail closed: no credentials → store stays open.
  return evaluateFlag(UNDER_CONSTRUCTION_FLAG_KEY, false);
}

export async function evaluateFlowersEnabled(): Promise<boolean> {
  // Fail open: no credentials → catalogue stays visible.
  return evaluateFlag(FLOWERS_FLAG_KEY, true);
}

// Reads the build-time value set by next.config.ts (defaults to open).
export function isUnderConstruction(): boolean {
  return process.env.UNDER_CONSTRUCTION === "true";
}

// Reads the build-time value set by next.config.ts (defaults to enabled).
export function isFlowersEnabled(): boolean {
  return process.env.FLOWERS_ENABLED !== "false";
}

// Predicates for hiding flower entries when the catalogue flag is off.
// Server-only use: this module pulls in node:https for build-time evaluation.
export function isFlowersHref(href: string): boolean {
  return href === "/flowers";
}

export function isFlowerCategory(category: string): boolean {
  return category === "flower";
}
