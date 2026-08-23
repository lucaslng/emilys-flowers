// Uses a temp fixture dir via the injectable baseDir — never touches
// the real public/products folder.

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanProductImages } from "@/lib/product-image-manifest";

describe("scanProductImages", () => {
  let baseDir: string;

  beforeAll(() => {
    baseDir = mkdtempSync(path.join(tmpdir(), "product-images-"));
  });

  afterAll(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  function makeProductDir(slug: string, files: string[]) {
    const dir = path.join(baseDir, slug);
    mkdirSync(dir, { recursive: true });
    for (const file of files) writeFileSync(path.join(dir, file), "");
  }

  test("maps each product folder to its first sorted image", () => {
    makeProductDir("green-evangeline", [
      "02-detail.jpg",
      "01-main.jpg",
      "03-lifestyle.jpg",
    ]);

    expect(scanProductImages(baseDir)).toEqual({
      "green-evangeline": "/products/green-evangeline/01-main.jpg",
    });
  });

  test("filters non-image files and matches case-insensitive extensions", () => {
    makeProductDir("creamy-white", [
      "cover.PNG",
      ".DS_Store",
      "notes.txt",
      "01-main.webp",
    ]);

    expect(scanProductImages(baseDir)["creamy-white"]).toBe(
      "/products/creamy-white/01-main.webp"
    );
  });

  test("slugifies folder names for manifest keys", () => {
    makeProductDir("Pink_Evangeline!", ["01-main.jpg"]);

    expect(scanProductImages(baseDir)["pink-evangeline"]).toBe(
      "/products/Pink_Evangeline!/01-main.jpg"
    );
  });

  test("omits folders with no image files, files, and missing dirs", () => {
    makeProductDir("empty-folder", [".DS_Store"]);
    writeFileSync(path.join(baseDir, "stray-file.jpg"), "");

    const manifest = scanProductImages(baseDir);
    expect(manifest["empty-folder"]).toBeUndefined();
    expect(manifest["stray-file"]).toBeUndefined();

    // A nonexistent base dir yields an empty manifest rather than throwing.
    expect(scanProductImages(path.join(baseDir, "no-such-dir"))).toEqual({});
  });
});
