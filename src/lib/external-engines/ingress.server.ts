export type ExternalEngineIngressHandler = (
  request: Request,
) => Promise<Response | null> | Response | null;

const handlers = new Map<string, ExternalEngineIngressHandler>();

export function registerExternalEngineIngress(
  pathname: string,
  handler: ExternalEngineIngressHandler,
) {
  if (!pathname.startsWith("/")) {
    throw new Error("External engine ingress paths must start with '/'.");
  }
  handlers.set(pathname, handler);
}

export async function handleExternalEngineIngress(request: Request) {
  const pathname = new URL(request.url).pathname;
  const handler = handlers.get(pathname);
  return handler ? await handler(request) : null;
}

export function listExternalEngineIngressPaths() {
  return Array.from(handlers.keys()).sort();
}
