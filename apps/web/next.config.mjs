/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@chainmon/shared",
    "@chainmon/monster-data",
    "@chainmon/game-engine",
  ],
};

export default nextConfig;
