import type { NextConfig } from "next";

// In Docker this is http://backend:8000/api/v1. Keep the browser-facing
// application and its event-detail APIs on the same backend/data snapshot.
const backendBase = process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
