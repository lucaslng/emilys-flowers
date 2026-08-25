import { test, expect, describe, afterEach } from "bun:test";
import { unsetEnv } from "./env-helpers";
import {
  flowersEnabledFromEvaluateResponse,
  underConstructionFromEvaluateResponse,
  flagshipEvaluateUrl,
  FLOWERS_FLAG_KEY,
  UNDER_CONSTRUCTION_FLAG_KEY,
  isFlowersEnabled,
  isUnderConstruction,
  evaluateFlowersEnabled,
  evaluateUnderConstruction,
} from "@/lib/flagship-flag";

describe("underConstructionFromEvaluateResponse", () => {
  test("true when value is true", () => {
    expect(underConstructionFromEvaluateResponse({ value: true })).toBe(true);
  });

  test("false when value is false", () => {
    expect(underConstructionFromEvaluateResponse({ value: false })).toBe(false);
  });

  test("false when value is missing", () => {
    expect(underConstructionFromEvaluateResponse({})).toBe(false);
  });

  test("false when payload is malformed (null)", () => {
    expect(underConstructionFromEvaluateResponse(null)).toBe(false);
  });
});

describe("flowersEnabledFromEvaluateResponse", () => {
  test("true when value is true", () => {
    expect(flowersEnabledFromEvaluateResponse({ value: true })).toBe(true);
  });

  test("false when value is false", () => {
    expect(flowersEnabledFromEvaluateResponse({ value: false })).toBe(false);
  });

  test("true when value is missing", () => {
    expect(flowersEnabledFromEvaluateResponse({})).toBe(true);
  });

  test("true when payload is malformed (null)", () => {
    expect(flowersEnabledFromEvaluateResponse(null)).toBe(true);
  });
});

describe("flagshipEvaluateUrl", () => {
  test("contains each flag key and account/app IDs", () => {
    for (const flagKey of [UNDER_CONSTRUCTION_FLAG_KEY, FLOWERS_FLAG_KEY]) {
      const url = flagshipEvaluateUrl("acct-1", "app-1", flagKey);
      expect(url).toContain(`flagKey=${flagKey}`);
      expect(url).toContain("acct-1");
      expect(url).toContain("app-1");
    }
  });
});

describe("evaluateUnderConstruction", () => {
  const original = {
    appId: process.env.FLAGSHIP_APP_ID,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    enabled: process.env.UNDER_CONSTRUCTION_ENABLED,
  };

  afterEach(() => {
    if (original.appId === undefined) unsetEnv("FLAGSHIP_APP_ID");
    else process.env.FLAGSHIP_APP_ID = original.appId;
    if (original.accountId === undefined) unsetEnv("CLOUDFLARE_ACCOUNT_ID");
    else process.env.CLOUDFLARE_ACCOUNT_ID = original.accountId;
    if (original.apiToken === undefined) unsetEnv("CLOUDFLARE_API_TOKEN");
    else process.env.CLOUDFLARE_API_TOKEN = original.apiToken;
    if (original.enabled === undefined) unsetEnv("UNDER_CONSTRUCTION_ENABLED");
    else process.env.UNDER_CONSTRUCTION_ENABLED = original.enabled;
  });

  test("false when UNDER_CONSTRUCTION_ENABLED is not 'true' (preview/dev builds)", async () => {
    unsetEnv("UNDER_CONSTRUCTION_ENABLED");
    process.env.FLAGSHIP_APP_ID = "app";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    process.env.CLOUDFLARE_API_TOKEN = "token";
    expect(await evaluateUnderConstruction()).toBe(false);
  });

  test("false when Flagship credentials are missing (local dev, E2E)", async () => {
    process.env.UNDER_CONSTRUCTION_ENABLED = "true";
    unsetEnv("FLAGSHIP_APP_ID");
    unsetEnv("CLOUDFLARE_ACCOUNT_ID");
    unsetEnv("CLOUDFLARE_API_TOKEN");
    expect(await evaluateUnderConstruction()).toBe(false);
  });
});

describe("evaluateFlowersEnabled", () => {
  const original = {
    appId: process.env.FLAGSHIP_APP_ID,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  };

  afterEach(() => {
    if (original.appId === undefined) unsetEnv("FLAGSHIP_APP_ID");
    else process.env.FLAGSHIP_APP_ID = original.appId;
    if (original.accountId === undefined) unsetEnv("CLOUDFLARE_ACCOUNT_ID");
    else process.env.CLOUDFLARE_ACCOUNT_ID = original.accountId;
    if (original.apiToken === undefined) unsetEnv("CLOUDFLARE_API_TOKEN");
    else process.env.CLOUDFLARE_API_TOKEN = original.apiToken;
  });

  test("true when Flagship credentials are missing (local dev, E2E)", async () => {
    unsetEnv("FLAGSHIP_APP_ID");
    unsetEnv("CLOUDFLARE_ACCOUNT_ID");
    unsetEnv("CLOUDFLARE_API_TOKEN");
    expect(await evaluateFlowersEnabled()).toBe(true);
  });
});

describe("isUnderConstruction", () => {
  afterEach(() => {
    unsetEnv("UNDER_CONSTRUCTION");
  });

  test("true when UNDER_CONSTRUCTION is 'true'", () => {
    process.env.UNDER_CONSTRUCTION = "true";
    expect(isUnderConstruction()).toBe(true);
  });

  test("false when UNDER_CONSTRUCTION is unset", () => {
    unsetEnv("UNDER_CONSTRUCTION");
    expect(isUnderConstruction()).toBe(false);
  });

  test("false when UNDER_CONSTRUCTION is 'false'", () => {
    process.env.UNDER_CONSTRUCTION = "false";
    expect(isUnderConstruction()).toBe(false);
  });

  test("false when UNDER_CONSTRUCTION is 'TRUE'", () => {
    process.env.UNDER_CONSTRUCTION = "TRUE";
    expect(isUnderConstruction()).toBe(false);
  });

  test("false when UNDER_CONSTRUCTION is '1'", () => {
    process.env.UNDER_CONSTRUCTION = "1";
    expect(isUnderConstruction()).toBe(false);
  });

  // Exact-match contract: armed only by the literal "true" — whitespace or casing must not arm or disarm it.
  test("false when UNDER_CONSTRUCTION has a leading space", () => {
    process.env.UNDER_CONSTRUCTION = " true";
    expect(isUnderConstruction()).toBe(false);
  });

  test("false when UNDER_CONSTRUCTION has a trailing space", () => {
    process.env.UNDER_CONSTRUCTION = "true ";
    expect(isUnderConstruction()).toBe(false);
  });

  test("false when UNDER_CONSTRUCTION is 'True' (case-sensitive)", () => {
    process.env.UNDER_CONSTRUCTION = "True";
    expect(isUnderConstruction()).toBe(false);
  });
});

describe("isFlowersEnabled", () => {
  const original = process.env.FLOWERS_ENABLED;

  afterEach(() => {
    if (original === undefined) unsetEnv("FLOWERS_ENABLED");
    else process.env.FLOWERS_ENABLED = original;
  });

  test("false only when FLOWERS_ENABLED is exactly 'false'", () => {
    process.env.FLOWERS_ENABLED = "false";
    expect(isFlowersEnabled()).toBe(false);
  });

  test("true when unset", () => {
    unsetEnv("FLOWERS_ENABLED");
    expect(isFlowersEnabled()).toBe(true);
  });

  test("true when 'true'", () => {
    process.env.FLOWERS_ENABLED = "true";
    expect(isFlowersEnabled()).toBe(true);
  });

  test("true for any other value (case-sensitive, like UNDER_CONSTRUCTION)", () => {
    process.env.FLOWERS_ENABLED = "TRUE";
    expect(isFlowersEnabled()).toBe(true);
    process.env.FLOWERS_ENABLED = "1";
    expect(isFlowersEnabled()).toBe(true);
  });
});
