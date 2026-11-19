import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { dbConfigured } from "./db";
import { getDomainState } from "./domains";
import { decideHost, effectiveHost, trustProxyEnabled, type HostDecision } from "./host-policy.ts";

async function decide(host: string, pathname: string): Promise<HostDecision> {
  if (!dbConfigured()) return "allow"; // nothing to compare against before the first setup
  const s = await getDomainState();
  return decideHost({ host, pathname, defaultHost: s.defaultHost, activeHosts: s.activeHosts, appHost: s.appHost });
}

/** Server components and actions: 404 unless this host may serve this path. */
export async function enforceHost(): Promise<void> {
  const h = await headers();
  const d = await decide(effectiveHost((n) => h.get(n), trustProxyEnabled()), h.get("x-ob-path") || "/");
  if (d === "notfound") notFound();
}

/** Route handlers: returns a bare 404 response, or null when the request may proceed. */
export async function guardRequest(req: Request): Promise<Response | null> {
  const d = await decide(effectiveHost((n) => req.headers.get(n), trustProxyEnabled()), new URL(req.url).pathname);
  return d === "notfound" ? new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } }) : null;
}

/** True when the current request arrived on the default domain. */
export async function onDefaultHost(): Promise<boolean> {
  const h = await headers();
  const s = await getDomainState();
  return effectiveHost((n) => h.get(n), trustProxyEnabled()) === s.defaultHost.toLowerCase();
}
