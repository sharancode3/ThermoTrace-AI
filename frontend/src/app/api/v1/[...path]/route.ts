import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000/api/v1";

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const subPath = resolvedParams.path?.join("/") || "";
  const search = request.nextUrl.search;
  const targetUrl = `${BACKEND_BASE}/${subPath}${search}`;

  try {
    const headers: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      if (key !== "host" && key !== "connection") {
        headers[key] = val;
      }
    });

    const init: RequestInit = {
      method: request.method,
      headers,
      cache: "no-store",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }

    const backendRes = await fetch(targetUrl, init);
    const body = await backendRes.arrayBuffer();

    const responseHeaders = new Headers();
    backendRes.headers.forEach((val, key) => {
      responseHeaders.set(key, val);
    });

    return new NextResponse(body, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(`[API PROXY ERROR] Failed to proxy to ${targetUrl}:`, err);
    return NextResponse.json({ error: err.message, targetUrl }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
