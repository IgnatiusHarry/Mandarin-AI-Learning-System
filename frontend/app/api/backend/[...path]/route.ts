import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://localhost:8001";
const BACKEND_TIMEOUT_MS = 8000;

async function forward(request: NextRequest, method: string) {
  const path = request.nextUrl.pathname.replace(/^\/api\/backend/, "");
  const targetUrl = new URL(`${BACKEND_URL}${path}${request.nextUrl.search}`);

  const headers = new Headers(request.headers);
  headers.delete("host");

  const hasBody = !["GET", "HEAD"].includes(method);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method,
      headers,
      body: hasBody ? await request.text() : undefined,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Backend timeout. Please try again." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Backend unreachable." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest) {
  return forward(request, "GET");
}

export async function POST(request: NextRequest) {
  return forward(request, "POST");
}

export async function PUT(request: NextRequest) {
  return forward(request, "PUT");
}

export async function PATCH(request: NextRequest) {
  return forward(request, "PATCH");
}

export async function DELETE(request: NextRequest) {
  return forward(request, "DELETE");
}

export async function OPTIONS(request: NextRequest) {
  return forward(request, "OPTIONS");
}
