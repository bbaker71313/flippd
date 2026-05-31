/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@sfp/shared"],
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          destination: '/index.html',
        },
      ],
    }
  },
};

module.exports = nextConfig;
