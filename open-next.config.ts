// open-next.config.ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
	// Serve build-time prerendered pages from Workers Static Assets. This app is
	// fully static (hardcoded products, no ISR/SSG data fetching), so the
	// read-only static-assets cache is the right fit: it makes the worker serve
	// the prerendered HTML (with build-time Flagship flag values baked in)
	// instead of re-rendering every page at runtime, where the build-time
	// process.env flag values don't exist. Requires `populateCache local` after
	// `build` and before `deploy`/`upload` (see deploy.yml) so the prerendered
	// cache lands in the assets at `cdn-cgi/_next_cache/`.
	// See https://opennext.js.org/cloudflare/caching for the alternatives
	// (R2 for revalidation, KV for eventually-consistent reads).
	incrementalCache: staticAssetsIncrementalCache
});
