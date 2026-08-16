import { test, expect, describe } from "bun:test";
import {
  flowersEnabledFromEvaluateResponse,
  flagshipEvaluateUrl,
  FLOWERS_FLAG_KEY,
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