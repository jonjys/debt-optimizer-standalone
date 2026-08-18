/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Allow iframe from fred-platform + vercel previews + localhost
          // Do NOT set X-Frame-Options — it overrides CSP frame-ancestors for cross-origin embeds
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://fred-platform.vercel.app https://*.vercel.app http://localhost:3000 http://localhost:3001;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
