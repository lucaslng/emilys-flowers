import { MetadataRoute } from 'next';

const baseUrl = 'https://emilys-flowers.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '',
    '/flowers',
    '/bouquets',
  ];

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/flowers' || route === '/bouquets' ? 0.8 : 0.5,
  }));
}
