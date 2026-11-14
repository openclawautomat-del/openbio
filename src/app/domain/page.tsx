import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { phase2Enabled } from "@/lib/features";
import { reqInfo } from "@/lib/request";
import { recordClick } from "@/lib/analytics";
import { getPublicPage } from "@/lib/services/public";
import { PublicPageView } from "@/components/public-page";
import "../bio.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: true, follow: true } };

async function ownerFor(host: string) {
  return queryOne<{ username: string }>(
    `SELECT u.username FROM domains d JOIN users u ON u.id = d.user_id
      WHERE d.hostname = ? AND d.verified_at IS NOT NULL AND u.status = 'active'`,
    [host],
  );
}

/** Root of a verified custom domain shows its owner's bio page. Reached through middleware rewrite. */
export default async function DomainHome() {
  if (!phase2Enabled()) notFound();
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").toLowerCase().split(":")[0];
  if (!host) notFound();
  const owner = await ownerFor(host).catch(() => null);
  if (!owner) notFound();
  const data = await getPublicPage(owner.username);
  if (!data) notFound();
  const b = await getBrand();
  await recordClick({ type: "page", id: data.page.id, userId: data.user.id, info: await reqInfo(), ownHost: b.host });
  return <PublicPageView data={data} brand={b} />;
}
