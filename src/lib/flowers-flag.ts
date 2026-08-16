import { cache } from "react";
import https from "node:https";

export const FLOWERS_FLAG_KEY = "enable-flowers-page";

export function flagshipEvaluateUrl(accountId: string, appId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/flagship/apps/${appId}/evaluate?flagKey=${FLOWERS_FLAG_KEY}`;
}

export function flowersEnabledFromEvaluateResponse(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return true;
  return (data as { value?: unknown }).value !== false;
}

// Uses Node's `https` module instead of the global `fetch` so Next.js's Data
// Cache never intercepts the request. A cached fetch would serve a stale flag
// value from a previous build (the Data Cache persists across builds with a
// 1-year revalidate); the flag must be re-evaluated fresh on every build.
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

async function fetchFlowersEnabled(): Promise<boolean> {
  const appId = process.env.FLAGSHIP_APP_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.FLAGSHIP_API_TOKEN;

  // No Flagship credentials (local dev, E2E) → catalogue stays visible.
  if (!appId || !accountId || !apiToken) return true;

  return evaluateFlag(flagshipEvaluateUrl(accountId, appId), apiToken);
}

export const isFlowersEnabled = cache(fetchFlowersEnabled);