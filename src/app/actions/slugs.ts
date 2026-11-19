"use server";

import { revalidatePath } from "next/cache";
import { exec, queryOne } from "@/lib/db";
import { audit, destroyAllSessions, requireAdmin } from "@/lib/auth";
import { addListValue, removeListValue } from "@/lib/slug-service";
import { clearSlugCache } from "@/lib/slug-cache";
import type { FormState } from "@/components/client";

const done = () => { clearSlugCache(); revalidatePath("/admin/slugs"); revalidatePath("/admin/reports"); };

export async function addSlugListAction(kind: "reserved" | "brand" | "sensitive", _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  if (!["reserved", "brand", "sensitive"].includes(kind)) return { errors: { form: "Unknown list." } };
  const ok = await addListValue(kind, String(fd.get("value") ?? ""));
  if (!ok) return { errors: { value: "Use letters, numbers, dots, hyphens or underscores." } };
  await audit(me.id, `slugs.${kind}.add`, String(fd.get("value") ?? "").slice(0, 64));
  done();
  return { ok: true, message: "Added." };
}

export async function removeSlugListAction(id: number): Promise<void> {
  const me = await requireAdmin();
  await removeListValue(id);
  await audit(me.id, "slugs.remove", String(id));
  done();
}

/** Review queue: approving makes the link or page live; rejecting switches it off for good. */
export async function reviewAction(type: "link" | "page", id: number, decision: "approved" | "rejected"): Promise<void> {
  const me = await requireAdmin();
  const table = type === "link" ? "links" : "pages";
  await exec(`UPDATE ${table} SET review_status = ? WHERE id = ? AND review_status = 'pending'`, [decision, id]);
  await audit(me.id, `review.${decision}`, `${type}:${id}`);
  done();
}

/** One-click abuse actions used from the review queue and from reports. */
export async function disableLinkAction(id: number): Promise<void> {
  const me = await requireAdmin();
  await exec("UPDATE links SET moderated = 1 WHERE id = ?", [id]);
  await audit(me.id, "link.disable", String(id));
  done();
}

export async function suspendOwnerAction(userId: number): Promise<void> {
  const me = await requireAdmin();
  if (userId === me.id) return;
  const t = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = ?", [userId]);
  if (!t || t.role === "super_admin") return;
  await exec("UPDATE users SET status = 'suspended' WHERE id = ?", [userId]);
  await destroyAllSessions(userId);
  await audit(me.id, "user.suspend", String(userId));
  done();
}

export async function blocklistDestinationAction(linkId: number): Promise<void> {
  const me = await requireAdmin();
  const l = await queryOne<{ target_url: string }>("SELECT target_url FROM links WHERE id = ?", [linkId]);
  if (!l) return;
  let host = "";
  try { host = new URL(l.target_url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return; }
  if (host) {
    await exec("INSERT IGNORE INTO blocklist (kind, value) VALUES ('domain', ?)", [host]);
    await audit(me.id, "blocklist.add", `domain:${host}`);
  }
  done();
}
