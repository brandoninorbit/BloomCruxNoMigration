import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
      remotePatterns: [
        { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
        { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      ],
  },
};

export default nextConfig;
