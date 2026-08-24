import type { MetadataRoute } from 'next';
import { isUnderConstruction } from '@/lib/flagship-flag';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  // During construction the whole site is a placeholder — block crawling so
  // the construction page never gets indexed. The sitemap stays advertised so
  // it's ready the moment the store opens.
  const sitemap = `${SITE_URL}/sitemap.xml`;
  if (isUnderConstruction()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      sitemap,
    };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cart', '/checkout', '/api/'],
    },
    sitemap,
  };
}
