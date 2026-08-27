import { MetadataRoute } from 'next';
import { getAllProducts } from '@/lib/stripe-catalog';
import { isFlowerCategory, isFlowersEnabled } from '@/lib/flagship-flag';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const showFlowers = isFlowersEnabled();
  const products = await getAllProducts();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...(showFlowers
      ? ([
          {
            url: `${SITE_URL}/flowers`,
            changeFrequency: 'monthly',
            priority: 0.8,
          },
        ] as MetadataRoute.Sitemap)
      : []),
    {
      url: `${SITE_URL}/bouquets`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/faq`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products
    .filter((p) => showFlowers || !isFlowerCategory(p.category))
    .map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified:
        typeof p.updatedAt === 'number'
          ? new Date(p.updatedAt * 1000)
          : undefined,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));

  return [...staticRoutes, ...productRoutes];
}
