import fs from 'fs'
import path from 'path'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import { GetPlatformProxyOptions } from 'wrangler'
import { s3Storage } from '@payloadcms/storage-s3'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Products } from './collections/Products'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const realpath = (value: string) => (fs.existsSync(value) ? fs.realpathSync(value) : undefined)

const isCLI = process.argv.some((value) => realpath(value)?.endsWith(path.join('payload', 'bin.js')))
const isProduction = process.env.NODE_ENV === 'production'

const createLog =
  (level: string, fn: typeof console.log) => (objOrMsg: object | string, msg?: string) => {
    if (typeof objOrMsg === 'string') {
      fn(JSON.stringify({ level, msg: objOrMsg }))
    } else {
      fn(JSON.stringify({ level, ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }))
    }
  }

const cloudflareLogger = {
  level: process.env.PAYLOAD_LOG_LEVEL || 'info',
  trace: createLog('trace', console.debug),
  debug: createLog('debug', console.debug),
  info: createLog('info', console.log),
  warn: createLog('warn', console.warn),
  error: createLog('error', console.error),
  fatal: createLog('fatal', console.error),
  silent: () => {},
} as any

const cloudflare =
  isCLI || !isProduction
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true })

// The `D1` binding is declared in wrangler.jsonc (infra lane) and will be
// reflected in `cloudflare-env.d.ts` once `bun run cf-typegen` is re-run. Until
// then the generated CloudflareEnv type doesn't include it, so type it here
// from the consumer that requires it rather than loosening strictness.
// Backblaze B2 credentials/bucket are plain env vars (`B2_*`), read from
// `process.env` like `PAYLOAD_SECRET` — no binding or type cast needed.
const env = cloudflare.env as CloudflareEnv & {
  D1: Parameters<typeof sqliteD1Adapter>[0]['binding']
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Products],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteD1Adapter({ binding: env.D1 }),
  logger: isProduction ? cloudflareLogger : undefined,
  plugins: [
    s3Storage({
      collections: { media: true },
      bucket: process.env.B2_MEDIA_BUCKET ?? '',
      config: {
        credentials: {
          accessKeyId: process.env.B2_APPLICATION_KEY_ID ?? '',
          secretAccessKey: process.env.B2_APPLICATION_KEY ?? '',
        },
        region: process.env.B2_REGION ?? '',
        // B2's S3-compatible endpoint; path-style URLs (B2 has no virtual-host
        // TLS for dotted bucket names). Do NOT set `acl` — B2 has no object-level
        // ACLs; make the bucket `allPublic` or use `signedDownloads` instead.
        endpoint: `https://s3.${process.env.B2_REGION ?? ''}.backblazeb2.com`,
        forcePathStyle: true,
        // @aws-sdk/client-s3 >= 3.66 sends CRC32 request checksums by default,
        // which B2 rejects — only checksum when the API requires it.
        requestChecksumCalculation: 'WHEN_REQUIRED',
      },
    }),
  ],
})

function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        remoteBindings: isProduction,
      } satisfies GetPlatformProxyOptions),
  )
}
