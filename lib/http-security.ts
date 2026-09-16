export const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Cross-site browser form submissions must not create or clear a session.
export function isSameOrigin(request: Request) {
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return false;
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: SECURITY_HEADERS });
}
