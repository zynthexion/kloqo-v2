/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kloqo/shared'],
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
