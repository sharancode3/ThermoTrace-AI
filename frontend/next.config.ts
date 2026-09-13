import type { NextConfig } from "next";

import fs from "node:fs";

const ACTIVE_RENDER = "https://thermotrace-ai-5tao.onrender.com/api/v1";
let backendBase = process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || ACTIVE_RENDER;

// Guarantee routing to the active live backend
if (!backendBase || !backendBase.includes("5tao")) {
  backendBase = ACTIVE_RENDER;
}

const cleanBackend = backendBase.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${cleanBackend}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
