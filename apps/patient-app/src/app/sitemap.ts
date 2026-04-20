import { MetadataRoute } from 'next';
import { apiRequest } from '@/lib/api-client';
import { Doctor } from '@kloqo/shared';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://kloqo.com';

    // Static routes
    const routes = [
        '',
        '/login',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
    }));

    // Dynamic doctor routes generation disabled per security/non-SEO policy
    const doctorRoutes: MetadataRoute.Sitemap = [];

    return [...routes, ...doctorRoutes];
}
