/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  images: {
    domains: ['i.imgur.com', 'img.clerk.com'], // Combine all allowed domains in a single array
  },
};

export default nextConfig;
