import { isReservedRoute } from "./slug-rules.ts";

/** Lowercase, no port, no trailing dot. */
export function normalizeHost(h: string): string {
  return String(h ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/**
 * Public content = short links and bio pages: `/<slug>`, `/out/<id>` and the vCard download.
 * Everything else (dashboard, admin, API, installer, auth, legal pages, assets) is "console".
 */
export function isPublicContentPath(pathname: string): boolean {
  const seg = pathname.split("?")[0].split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  if (!seg) return false;
  if (seg === "out") return true;
  if (seg === "api") return pathname.toLowerCase().startsWith("/api/vcard/");
  return !isReservedRoute(seg);
}

export interface HostCtx {
  host: string;
  pathname: string;
  defaultHost: string;
  /** Hosts of domains with status "active". */
  activeHosts: Iterable<string>;
  /** Host of APP_URL. Always allowed so nobody is locked out. */
  appHost: string;
}
export type HostDecision = "allow" | "notfound";

/**
 * - /api/health answers on any host (it is how a new domain proves it reaches this app).
 * - Default domain: everything.
 * - Other active domains and the APP_URL host: console routes only; public content is a plain 404.
 * - Unknown host: 404 for everything.
 */
export function decideHost(c: HostCtx): HostDecision {
  if (c.pathname === "/api/health") return "allow";
  const h = normalizeHost(c.host);
  if (!h) return "notfound";
  if (h === normalizeHost(c.defaultHost)) return "allow";
  const known = h === normalizeHost(c.appHost) || new Set([...c.activeHosts].map(normalizeHost)).has(h);
  if (!known) return "notfound";
  return isPublicContentPath(c.pathname) ? "notfound" : "allow";
}

/**
 * Forwarded headers are only honoured when TRUST_PROXY=true, otherwise a client could spoof the host.
 */
export function effectiveHost(get: (name: string) => string | null | undefined, trustProxy: boolean): string {
  const fwd = trustProxy ? (get("x-forwarded-host") || "").split(",")[0].trim() : "";
  return normalizeHost(fwd || get("host") || "");
}
export function effectiveProto(get: (name: string) => string | null | undefined, trustProxy: boolean, fallback = "https"): string {
  const p = trustProxy ? (get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase() : "";
  return p === "http" || p === "https" ? p : fallback;
}
export const trustProxyEnabled = () => (process.env.TRUST_PROXY || "").toLowerCase() === "true";
