import { NextResponse } from "next/server";

/**
 * Compression middleware for API responses
 * Automatically compresses responses using gzip or brotli
 */
export async function compressResponse(response: NextResponse, request: Request): Promise<NextResponse> {
  const acceptEncoding = request.headers.get("accept-encoding") || "";
  
  // Don't compress if already compressed or if response is too small
  if (response.headers.get("content-encoding")) {
    return response;
  }

  const body = await response.text();
  const bodySize = Buffer.byteLength(body, "utf8");
  
  // Don't compress small responses (< 1KB)
  if (bodySize < 1024) {
    return NextResponse.json(JSON.parse(body), {
      status: response.status,
      headers: response.headers,
    });
  }

  // Use Node.js built-in zlib for compression (gzip is standard)
  if (acceptEncoding.includes("gzip") || acceptEncoding.includes("deflate")) {
    try {
      const { gzipSync } = await import("zlib");
      const compressed = gzipSync(body, { level: 6 });
      if (compressed.length < bodySize) {
        const compressedResponse = new NextResponse(compressed, {
          status: response.status,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            "content-encoding": "gzip",
            "content-type": response.headers.get("content-type") || "application/json",
            "vary": "Accept-Encoding",
          },
        });
        return compressedResponse;
      }
    } catch (_err) {
      // Compression failed, return original
    }
  }

  return NextResponse.json(JSON.parse(body), {
    status: response.status,
    headers: response.headers,
  });
}
