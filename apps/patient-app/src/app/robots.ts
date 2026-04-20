import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            disallow: ['/doctors', '/doctors/*', '/profile', '/book-appointment', '/confirm-arrival'],
        },
        sitemap: 'https://kloqo.com/sitemap.xml',
    };
}
