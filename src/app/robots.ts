import type { MetadataRoute } from 'next';
import { isUnderConstruction } from '@/lib/flagship-flag';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  // Block crawling during construction so the placeholder never gets indexed;
  // the sitemap stays advertised for when the store opens.
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
