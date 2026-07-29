// sitemap.ts

import { MetadataRoute } from 'next';

const baseUrl = 'https://emilysflowers.ca';
const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '',
    '/flowers',
    '/bouquets',
  ];

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/flowers' || route === '/bouquets' ? 0.8 : 0.5,
  }));
}
