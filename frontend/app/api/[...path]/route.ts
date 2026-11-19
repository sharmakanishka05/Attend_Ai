import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBaseUrl() {
  const value = process.env.BACKEND_URL?.trim();
  return value ? value.replace(/\/+$/, "").replace(/\/api$/, "") : null;
}

async function proxy(request: NextRequest, { params }: { params: { path: string[] } }) {
  const backendUrl = backendBaseUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { detail: "The attendance API is not configured for this deployment." },
      { status: 503 },
    );
  }

  const upstreamUrl = `${backendUrl}/api/${params.path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.set("x-forwarded-host", request.headers.get("host") || "");
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-length");
    responseHeaders.delete("content-encoding");
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json(
      { detail: "The attendance service is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
