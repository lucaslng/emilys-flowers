// payload.config.ts

import sharp from 'sharp';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite';
import { buildConfig } from 'payload';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export default buildConfig({
  editor: lexicalEditor(),
  collections: [],
  secret: process.env.PAYLOAD_SECRET || '',
  db: sqliteD1Adapter({
		binding: (await getCloudflareContext({async: true})).env.D1,
	}),
  sharp,
})