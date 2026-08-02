import { test, expect, describe, afterEach } from "bun:test";
import { isUnderConstruction } from "@/lib/under-construction";

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
