/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Allow iframe embed from fred-platform (and localhost for dev)
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://fred-platform.vercel.app https://*.vercel.app http://localhost:3000 http://localhost:3001;",
          },
          // Explicitly do NOT set X-Frame-Options: DENY (would block iframe)
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
