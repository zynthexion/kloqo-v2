/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kloqo/shared', '@kloqo/shared-core', '@kloqo/shared-firebase'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
};

export default nextConfig;
