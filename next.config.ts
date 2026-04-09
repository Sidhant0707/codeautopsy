import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vgbujcuwptvheqijyjbe.supabase.co",
      },
    ],
  },
};

export default nextConfig;