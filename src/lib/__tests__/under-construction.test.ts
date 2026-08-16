import { test, expect, describe, afterEach } from "bun:test";
import {
  underConstructionFromEvaluateResponse,
  flagshipEvaluateUrl,
  UNDER_CONSTRUCTION_FLAG_KEY,
  evaluateUnderConstruction,
  isUnderConstruction,
} from "@/lib/under-construction";

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

describe("flagshipEvaluateUrl", () => {
  test("contains the flag key and account/app IDs", () => {
    const url = flagshipEvaluateUrl("acct-1", "app-1");
    expect(url).toContain(`flagKey=${UNDER_CONSTRUCTION_FLAG_KEY}`);
    expect(url).toContain("acct-1");
    expect(url).toContain("app-1");
  });
});

describe("evaluateUnderConstruction", () => {
  const original = {
    appId: process.env.FLAGSHIP_APP_ID,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.FLAGSHIP_API_TOKEN,
  };

  afterEach(() => {
    if (original.appId === undefined) delete process.env.FLAGSHIP_APP_ID;
    else process.env.FLAGSHIP_APP_ID = original.appId;
    if (original.accountId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = original.accountId;
    if (original.apiToken === undefined) delete process.env.FLAGSHIP_API_TOKEN;
    else process.env.FLAGSHIP_API_TOKEN = original.apiToken;
  });

  test("false when Flagship credentials are missing (local dev, E2E)", async () => {
    delete process.env.FLAGSHIP_APP_ID;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.FLAGSHIP_API_TOKEN;
    expect(await evaluateUnderConstruction()).toBe(false);
  });
});

describe("isUnderConstruction", () => {
  afterEach(() => {
    delete process.env.UNDER_CONSTRUCTION;
  });

  test("true when UNDER_CONSTRUCTION is 'true'", () => {
    process.env.UNDER_CONSTRUCTION = "true";
    expect(isUnderConstruction()).toBe(true);
  });

  test("false when UNDER_CONSTRUCTION is unset", () => {
    delete process.env.UNDER_CONSTRUCTION;
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

  // Exact-match contract: the gate is armed only by the literal string
  // "true". Whitespace or casing must not silently disarm or arm it.
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