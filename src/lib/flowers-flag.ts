import https from "node:https";

export const FLOWERS_FLAG_KEY = "enable-flowers-page";

export function flagshipEvaluateUrl(accountId: string, appId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/flagship/apps/${appId}/evaluate?flagKey=${FLOWERS_FLAG_KEY}`;
}

export function flowersEnabledFromEvaluateResponse(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return true;
  return (data as { value?: unknown }).value !== false;
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
          if (res.statusCode !== 200) return resolve(true);
          try {
            resolve(flowersEnabledFromEvaluateResponse(JSON.parse(body)));
          } catch {
            resolve(true);
          }
        });
      }
    );
    req.on("error", () => resolve(true));
    req.on("timeout", () => {
      req.destroy();
      resolve(true);
    });
  });
}

// Called once per build from next.config.ts; result stored in
// process.env.FLOWERS_ENABLED for all static-gen workers.
export async function evaluateFlowersEnabled(): Promise<boolean> {
  const appId = process.env.FLAGSHIP_APP_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  // No Flagship credentials (local dev, E2E) → catalogue stays visible.
  if (!appId || !accountId || !apiToken) return true;

  return evaluateFlag(flagshipEvaluateUrl(accountId, appId), apiToken);
}

// Reads the build-time value set by next.config.ts (defaults to enabled).
export function isFlowersEnabled(): boolean {
  return process.env.FLOWERS_ENABLED !== "false";
}