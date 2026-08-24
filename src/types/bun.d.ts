/// <reference types="bun-types" />

// TypeScript 6 does not auto-include `@types/bun` (its `main` is empty), so this file — picked up by the
// tsconfig `**/*.ts` include glob — pulls in `bun-types` explicitly so `bun:test` resolves under `tsc --noEmit`.