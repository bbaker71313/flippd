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
  async headers() {
    return [
      {
        // Prevent Cloudflare from caching the HTML files
        source: '/:path*.html',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
