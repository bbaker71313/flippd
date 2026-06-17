import { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://www.scanforprofit.com',
      lastModified: '2026-06-03',
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://www.scanforprofit.com/roadmap',
      lastModified: '2026-06-03',
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: 'https://www.scanforprofit.com/privacy',
      lastModified: '2026-06-03',
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: 'https://www.scanforprofit.com/terms',
      lastModified: '2026-06-03',
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]
}
