import type { NextConfig } from "next";

import fs from "node:fs";

const isDocker = fs.existsSync("/.dockerenv");
const backendBase = process.env.INTERNAL_BACKEND_URL || (isDocker ? "http://backend:8000/api/v1" : "http://127.0.0.1:8000/api/v1");
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
