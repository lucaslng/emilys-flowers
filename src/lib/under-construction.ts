import https from "node:https";

export const UNDER_CONSTRUCTION_FLAG_KEY = "under-construction";

export function flagshipEvaluateUrl(accountId: string, appId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/flagship/apps/${appId}/evaluate?flagKey=${UNDER_CONSTRUCTION_FLAG_KEY}`;
}

export function underConstructionFromEvaluateResponse(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  return (data as { value?: unknown }).value === true;
}

// Use `https`, not `fetch`, so Next.js's Data Cache never serves a stale
// flag value from a previous build.
function evaluateFlag(url: string, apiToken: string): Promise<boolean> {
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
          if (res.statusCode !== 200) return resolve(false);
          try {
            resolve(underConstructionFromEvaluateResponse(JSON.parse(body)));
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Called once per build from next.config.ts; result stored in
// process.env.UNDER_CONSTRUCTION for all static-gen workers.
export async function evaluateUnderConstruction(): Promise<boolean> {
  // Only the production build honors the flag: deploy.yml sets
  // UNDER_CONSTRUCTION_ENABLED there, and preview/dev builds skip evaluation
  // so previews always render the store, never the construction screen.
  if (process.env.UNDER_CONSTRUCTION_ENABLED !== "true") return false;

  const appId = process.env.FLAGSHIP_APP_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  // No Flagship credentials (local dev, E2E) → store stays open.
  if (!appId || !accountId || !apiToken) return false;

  return evaluateFlag(flagshipEvaluateUrl(accountId, appId), apiToken);
}

// Reads the build-time value set by next.config.ts (defaults to open).
export function isUnderConstruction(): boolean {
  return process.env.UNDER_CONSTRUCTION === "true";
}
