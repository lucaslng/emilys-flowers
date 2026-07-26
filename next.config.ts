import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
  experimental: {
    sri: {
      algorithm: 'sha256', // or 'sha384' or 'sha512'
    },
  },
};

export default nextConfig;
