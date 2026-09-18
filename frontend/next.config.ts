import type { NextConfig } from "next";

// In Docker this is overridden by INTERNAL_BACKEND_URL (http://backend:8000/api/v1).
// For standalone local dev, connects to the active live Render backend.
const ACTIVE_RENDER = "https://thermotrace-ai-rqjr.onrender.com/api/v1";
const backendBase = process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || ACTIVE_RENDER;

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
