// sitemap.ts

import { MetadataRoute } from 'next';
import { getAllProducts } from '@/lib/payload-catalog';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const products = await getAllProducts();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/flowers`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/bouquets`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes];
}