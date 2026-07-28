import type { NextConfig } from "next";

const apiUrl =
  process.env.API_UPSTREAM_URL?.replace(/\/+$/, "").replace(/\/api\/v1$/, "") ||
  "http://localhost:4000";

const nextConfig: NextConfig = {
  // Keep the development compiler isolated from production builds. Running
  // `next dev` and `next build` against the same output directory can leave a
  // mixed webpack runtime whose vendor-chunk references no longer exist.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  productionBrowserSourceMaps: false,
  transpilePackages: ["@mrh/types"],
  webpack(config) {
    config.module.rules.push({
      test: /packages[\\/]types[\\/]dist[\\/]index\.js$/,
      type: "javascript/auto",
    });
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/mrh-academy/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "randomuser.me",
        pathname: "/api/**",
      },
      {
        protocol: "https",
        hostname: "**.b-cdn.net",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/socket.io",
        destination: `${apiUrl}/socket.io/`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${apiUrl}/socket.io/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
