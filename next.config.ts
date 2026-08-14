import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cjobbggzalfwtqxzbpob.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
};

export default nextConfig;
