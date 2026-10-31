import { PLATFORM_VERSION, SDK_VERSION } from "../platform-manager.server";
import { getPublicProductionReadiness } from "../production.server";

function requestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

function json(data: unknown, status = 200, id?: string) {
  return new Response(
    JSON.stringify({
      success: status >= 200 && status < 400,
      data,
      meta: {
        request_id: id ?? crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

/**
 * Minimal public platform probes. They expose no user/engine data and do not
 * imply database readiness; storage/integration health remains authenticated
 * Platform Manager data.
 */
export async function handlePlatformProbe(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;

  const id = requestId(request);

  if (url.pathname === "/api/v1/health") {
    return json(
      {
        service: "humankernelos",
        status: "ok",
        platform_version: PLATFORM_VERSION,
        sdk_version: SDK_VERSION,
      },
      200,
      id,
    );
  }

  if (url.pathname === "/api/v1/readiness") {
    const readiness = await getPublicProductionReadiness();
    return json(
      {
        service: "humankernelos",
        ...readiness,
        platform_version: PLATFORM_VERSION,
        sdk_version: SDK_VERSION,
      },
      readiness.ready ? 200 : 503,
      id,
    );
  }

  return null;
}
