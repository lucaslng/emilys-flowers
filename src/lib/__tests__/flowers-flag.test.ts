import { test, expect, describe, afterEach } from "bun:test";
import {
  flowersEnabledFromEvaluateResponse,
  flagshipEvaluateUrl,
  FLOWERS_FLAG_KEY,
  isFlowersEnabled,
} from "@/lib/flowers-flag";

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
  test("contains the flag key and account/app IDs", () => {
    const url = flagshipEvaluateUrl("acct-1", "app-1");
    expect(url).toContain(`flagKey=${FLOWERS_FLAG_KEY}`);
    expect(url).toContain("acct-1");
    expect(url).toContain("app-1");
  });
});

describe("isFlowersEnabled", () => {
  const original = process.env.FLOWERS_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.FLOWERS_ENABLED;
    else process.env.FLOWERS_ENABLED = original;
  });

  test("false only when FLOWERS_ENABLED is exactly 'false'", () => {
    process.env.FLOWERS_ENABLED = "false";
    expect(isFlowersEnabled()).toBe(false);
  });

  test("true when unset", () => {
    delete process.env.FLOWERS_ENABLED;
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