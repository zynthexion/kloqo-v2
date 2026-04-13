import { MetadataRoute } from 'next';
import { apiRequest } from '@/lib/api-client';
import { Doctor } from '@kloqo/shared';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://kloqo.com';

    // Static routes
    const routes = [
        '',
        '/login',
        '/doctors',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
    }));

    // Dynamic doctor routes
    let doctorRoutes: MetadataRoute.Sitemap = [];
    try {
        // Fetch all doctors from the centralized backend
        // This hits the public discovery endpoint
        const doctors = await apiRequest<Doctor[]>('/doctors');
        
        if (Array.isArray(doctors)) {
            doctorRoutes = doctors.map((doc) => ({
                url: `${baseUrl}/doctors/${doc.id}`,
                lastModified: new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.8,
            }));
        }
    } catch (error) {
        console.error('Failed to generate doctor sitemap:', error);
    }

    return [...routes, ...doctorRoutes];
}
