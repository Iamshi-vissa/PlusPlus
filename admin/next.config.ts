import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Internal tool: never let search engines index it.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default config;
