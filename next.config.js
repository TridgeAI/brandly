/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15 moved this out of `experimental`
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

module.exports = nextConfig;
