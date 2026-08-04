// b2-incremental-cache.ts — OpenNext IncrementalCache override backed by Backblaze B2
//
// Replaces the R2 incremental cache (`r2IncrementalCache`) so ISR cache entries persist
// in B2's S3-compatible storage instead of a Cloudflare R2 bucket. `@opennextjs/cloudflare`
// ships no S3/B2 cache (verified against installed 1.20.2 — only r2/kv/regional/
// static-assets overrides exist), so this is a port of `@opennextjs/aws`'s s3-lite
// incremental cache with a path-style B2 endpoint and the Cloudflare adapter's
// `computeCacheKey` key layout (so `populate-cache` and the tag cache stay compatible).
//
// aws4fetch detects B2 hostnames natively (`s3.<region>.backblazeb2.com` → service `s3`
// + region), so no manual signing config is needed.
//
// Env vars — B2 credentials are secrets (set once per Worker via `wrangler secret put`):
//   B2_APPLICATION_KEY_ID  — B2 application key ID (secret)
//   B2_APPLICATION_KEY     — B2 application key (secret)
//   B2_REGION              — B2 cluster code, e.g. `us-west-004` (vars)
//   B2_CACHE_BUCKET        — bucket holding ISR cache entries (vars)
//   B2_CACHE_PREFIX        — optional key prefix; defaults to `incremental-cache`
import type { CacheEntryType, CacheValue } from "@opennextjs/aws/types/overrides.js";
import { error } from "@opennextjs/aws/adapters/logger.js";
import { IgnorableError } from "@opennextjs/aws/utils/error.js";
import { AwsClient } from "aws4fetch";
import { computeCacheKey, debugCache } from "@opennextjs/cloudflare/overrides/internal";

export const NAME = "b2-incremental-cache";
export const PREFIX_ENV_NAME = "B2_CACHE_PREFIX";

let awsClient: AwsClient | null = null;
const getAwsClient = (): AwsClient => {
	if (awsClient) return awsClient;
	awsClient = new AwsClient({
		accessKeyId: process.env.B2_APPLICATION_KEY_ID ?? "",
		secretAccessKey: process.env.B2_APPLICATION_KEY ?? "",
		region: process.env.B2_REGION ?? "",
	});
	return awsClient;
};

class B2IncrementalCache {
	name = NAME;

	async get<CacheType extends CacheEntryType = "cache">(key: string, cacheType?: CacheType) {
		const url = this.buildUrl(key, cacheType);
		debugCache("B2IncrementalCache", `get ${url}`);
		try {
			const response = await getAwsClient().fetch(url, { method: "GET" });
			if (response.status === 404) return null; // cache miss
			if (response.status !== 200) {
				error(`Failed to get from cache: ${response.status} (${url})`);
				return null;
			}
			return {
				value: (await response.json()) as CacheValue<CacheType>,
				lastModified: new Date(response.headers.get("last-modified") ?? "").getTime(),
			};
		} catch (e) {
			error("Failed to get from cache", e);
			return null;
		}
	}

	async set<CacheType extends CacheEntryType = "cache">(
		key: string,
		value: CacheValue<CacheType>,
		cacheType?: CacheType,
	) {
		const url = this.buildUrl(key, cacheType);
		debugCache("B2IncrementalCache", `set ${url}`);
		try {
			const response = await getAwsClient().fetch(url, {
				method: "PUT",
				body: JSON.stringify(value),
			});
			if (response.status !== 200) {
				error(`Failed to set to cache: ${response.status} (${url})`);
			}
		} catch (e) {
			error("Failed to set to cache", e);
		}
	}

	async delete(key: string) {
		const url = this.buildUrl(key, "cache");
		debugCache("B2IncrementalCache", `delete ${url}`);
		try {
			const response = await getAwsClient().fetch(url, { method: "DELETE" });
			if (response.status !== 204) {
				error(`Failed to delete from cache: ${response.status} (${url})`);
			}
		} catch (e) {
			error("Failed to delete from cache", e);
		}
	}

	private buildUrl(key: string, cacheType?: CacheEntryType): string {
		const { B2_CACHE_BUCKET, B2_REGION } = process.env;
		if (!B2_CACHE_BUCKET || !B2_REGION) {
			throw new IgnorableError("B2 cache env not configured (B2_CACHE_BUCKET/B2_REGION)");
		}
		const cacheKey = computeCacheKey(key, {
			prefix: process.env[PREFIX_ENV_NAME],
			buildId: process.env.OPEN_NEXT_BUILD_ID,
			cacheType,
		});
		return `https://s3.${B2_REGION}.backblazeb2.com/${B2_CACHE_BUCKET}/${cacheKey}`;
	}
}

export default new B2IncrementalCache();
