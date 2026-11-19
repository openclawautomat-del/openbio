import type { MetadataRoute } from "next";
import { getBrand } from "@/lib/brand";
import { query } from "@/lib/db";
import { onDefaultHost } from "@/lib/host-guard";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const b = await getBrand();
  if (!(await onDefaultHost())) return []; // bio pages are listed on the default domain only
  const out: MetadataRoute.Sitemap = ["", "/terms", "/privacy", "/docs"].map((p) => ({ url: `${b.url}${p}` }));
  try {
    // Published bio pages only. Short links are never listed.
    const rows = await query<{ username: string; created_at: Date }>(
      `SELECT u.username, p.created_at FROM pages p JOIN users u ON u.id = p.user_id
        WHERE p.published = 1 AND p.moderated = 0 AND u.status = 'active' ORDER BY p.created_at DESC LIMIT 5000`,
    );
    for (const r of rows) out.push({ url: `${b.url}/${r.username}`, lastModified: r.created_at });
  } catch {
    // Before install the tables do not exist; the static entries are enough.
  }
  return out;
}
