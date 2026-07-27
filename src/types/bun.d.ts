/// <reference types="bun-types" />

// Ensures the `bun:test` ambient module (and other Bun globals) are loaded
// for TypeScript. `@types/bun` only contains a `/// <reference types="bun-types" />`
// redirect, and TypeScript 6 does not auto-include `@types/bun` (its `main` is
// empty), so `bun:test` fails to resolve under `tsc --noEmit`. This file is
// picked up by the `**/*.ts` include glob in tsconfig.json and pulls in
// `bun-types` explicitly, which declares `declare module "bun:test"`.