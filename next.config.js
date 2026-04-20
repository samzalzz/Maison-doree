/** @type {import('next').NextConfig} */
// Cache bust: 2026-04-20 11:33:50Z - Force clean rebuild
const nextConfig = {
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
