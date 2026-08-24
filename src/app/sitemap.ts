import { MetadataRoute } from 'next';
import { getAllProducts } from '@/lib/stripe-catalog';
import { isFlowerCategory, isFlowersEnabled } from '@/lib/flagship-flag';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const showFlowers = isFlowersEnabled();
  const products = await getAllProducts();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...(showFlowers
      ? ([
          {
            url: `${SITE_URL}/flowers`,
            lastModified,
            changeFrequency: 'monthly',
            priority: 0.8,
          },
        ] as MetadataRoute.Sitemap)
      : []),
    {
      url: `${SITE_URL}/bouquets`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products
    .filter((p) => showFlowers || !isFlowerCategory(p.category))
    .map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));

  return [...staticRoutes, ...productRoutes];
}