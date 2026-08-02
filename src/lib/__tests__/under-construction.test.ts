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
});
