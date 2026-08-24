import type { MetadataRoute } from 'next';
import { isUnderConstruction } from '@/lib/flagship-flag';

export default function robots(): MetadataRoute.Robots {
  // During construction the whole site is a placeholder — block crawling so
  // the construction page never gets indexed. The sitemap stays advertised so
  // it's ready the moment the store opens.
  if (isUnderConstruction()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      sitemap: 'https://emilysflowers.ca/sitemap.xml',
    };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cart', '/checkout', '/api/'],
    },
    sitemap: 'https://emilysflowers.ca/sitemap.xml',
  };
}
