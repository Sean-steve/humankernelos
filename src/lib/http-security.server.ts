const BASE_SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "content-security-policy":
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
};

export function applySecurityHeaders(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }

  const requestId =
    request.headers.get("x-request-id") ?? headers.get("x-request-id") ?? crypto.randomUUID();
  headers.set("x-request-id", requestId);

  const url = new URL(request.url);
  if (process.env.NODE_ENV === "production" && url.protocol === "https:") {
    headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function securityHeaderNames() {
  return Object.keys(BASE_SECURITY_HEADERS).sort();
}
