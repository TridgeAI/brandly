/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverExternalPackages: ["@anthropic-ai/sdk"],
  },
};

module.exports = nextConfig;
