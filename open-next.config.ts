import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
	// Fully static app: serve build-time prerendered pages from Workers Static Assets instead of
	// re-rendering at runtime, where the build-time flag env vars don't exist. Requires `populateCache local`.
	incrementalCache: staticAssetsIncrementalCache
});
