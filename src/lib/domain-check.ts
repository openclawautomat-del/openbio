import type { CheckResult } from "./domain-service.ts";

type FetchLike = (url: string, init?: Record<string, unknown>) => Promise<{ status: number; headers: { get(n: string): string | null }; json(): Promise<unknown> }>;

/** Turns a low-level fetch/TLS error into a sentence an admin can act on. */
export function explainFetchError(err: unknown, host: string, timeoutMs: number): string {
  const e = err as { name?: string; code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.cause?.code || e?.code || "";
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT")
    return `Timed out after ${Math.round(timeoutMs / 1000)}s. The server did not answer on port 443. Check that the subdomain exists in hPanel and points to this app.`;
  switch (code) {
    case "ENOTFOUND": case "EAI_AGAIN":
      return `DNS lookup failed: ${host} does not resolve yet. Create the subdomain in hPanel and wait for DNS to propagate.`;
    case "ECONNREFUSED":
      return "Connection refused on port 443. The subdomain is not served over HTTPS yet.";
    case "ECONNRESET":
      return "The connection was reset during the TLS handshake. SSL is probably not installed for this subdomain yet.";
    case "CERT_HAS_EXPIRED":
      return "The SSL certificate has expired. Renew or reinstall it in hPanel.";
    case "DEPTH_ZERO_SELF_SIGNED_CERT": case "SELF_SIGNED_CERT_IN_CHAIN":
      return "The SSL certificate is self-signed, so browsers would reject it. Install a trusted certificate (hPanel > SSL).";
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE": case "UNABLE_TO_GET_ISSUER_CERT_LOCALLY": case "UNABLE_TO_GET_ISSUER_CERT":
      return "The SSL certificate chain is incomplete or not trusted. Reinstall the certificate (hPanel > SSL).";
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return `The SSL certificate does not cover ${host}. Install a certificate for this exact subdomain.`;
    case "CERT_NOT_YET_VALID":
      return "The SSL certificate is not valid yet (check the server clock).";
    case "EPROTO": case "ERR_SSL_WRONG_VERSION_NUMBER":
      return "The server does not speak HTTPS on port 443 for this domain. Install SSL for the subdomain first.";
  }
  return `Could not connect: ${code || e?.cause?.message || e?.message || "unknown error"}.`;
}

/**
 * GET https://<host>/api/health with certificate validation ON (Node's default; never disabled here).
 * Success means: TLS is valid for that host, there is no redirect, and the response is this app.
 */
export async function checkDomainHttps(host: string, opts: { fetchImpl?: FetchLike; timeoutMs?: number } = {}): Promise<CheckResult> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const f = (opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike));
  try {
    const res = await f(`https://${host}/api/health`, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "OpenBio-DomainCheck/1", accept: "application/json" },
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, error: `HTTPS works, but /api/health redirects to ${res.headers.get("location") || "another address"}. The domain must answer directly, without a redirect.` };
    }
    if (res.status === 404) return { ok: false, error: "HTTPS works, but /api/health returned 404. The subdomain points to a different site. In hPanel, map it to this Node.js app." };
    if (res.status !== 200) return { ok: false, error: `HTTPS works, but /api/health returned status ${res.status}.` };
    const body = (await res.json().catch(() => null)) as { ok?: unknown; app?: unknown } | null;
    if (!body || body.ok !== true || body.app !== "openbio") return { ok: false, error: "HTTPS works, but the response is not from this app. The subdomain may point to a parked page or another site." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: explainFetchError(e, host, timeoutMs) };
  }
}
