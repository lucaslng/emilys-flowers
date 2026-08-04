// open-next.config.ts — ISR wiring (Phase 1, on-demand-only revalidation)
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";
import b2IncrementalCache from "./b2-incremental-cache";

export default defineCloudflareConfig({
	incrementalCache: b2IncrementalCache,
	tagCache: d1NextTagCache,
	// Queue: NOT required for on-demand-only to update content — without an override the
	// dummy queue makes stale requests fall back to a BLOCKING re-render (fresh content on
	// next visit, but no stale-serve + background-regenerate). Verified in installed 1.20.2
	// (cacheInterceptor falls back to `return event` when queue.send throws). Add
	// memory-queue or doQueue later if stale-while-revalidate serving is wanted.
});
