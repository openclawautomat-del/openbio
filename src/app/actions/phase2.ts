"use server";

import dns from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { exec, query, queryOne } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { getBrand } from "@/lib/brand";
import { phase2Enabled } from "@/lib/features";
import { rateLimit } from "@/lib/ratelimit";
import { createLink } from "@/lib/services/links";
import { parseCsv } from "@/lib/csv";
import type { FormState } from "@/components/client";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const fail = (errors: Record<string, string>): FormState => ({ errors });
const done = (message: string): FormState => ({ ok: true, message });

async function guard() {
  if (!phase2Enabled()) throw new Error("Phase 2 features are turned off on this server.");
  return requireUser();
}

/* ---------- Custom domains ---------- */

const txtName = (hostname: string) => `_verify.${hostname}`;

export async function addDomainAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await guard();
  const host = s(fd, "hostname").toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/:\d+$/, "");
  if (!/^(?=.{4,190}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) return fail({ hostname: "Enter a domain like links.example.com." });
  const b = await getBrand();
  if (host === b.host) return fail({ hostname: "That is this site's own address." });
  const count = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM domains WHERE user_id = ?", [u.id]);
  if (Number(count?.n ?? 0) >= 5) return fail({ hostname: "You can connect up to 5 domains." });
  if (await queryOne("SELECT id FROM domains WHERE hostname = ?", [host])) return fail({ hostname: "That domain is already connected to an account." });
  await exec("INSERT INTO domains (user_id, hostname, verify_token) VALUES (?, ?, ?)", [u.id, host, randomToken(16)]);
  revalidatePath("/dashboard/domains");
  return done(`Added ${host}. Add the DNS records below, then press Check.`);
}

export async function verifyDomainAction(id: number): Promise<void> {
  const u = await guard();
  if (!(await rateLimit(`domain:verify:${u.id}`, 30, 3600))) return;
  const d = await queryOne<{ hostname: string; verify_token: string }>("SELECT hostname, verify_token FROM domains WHERE id = ? AND user_id = ?", [id, u.id]);
  if (!d) return;
  try {
    const recs = (await dns.resolveTxt(txtName(d.hostname))).map((r) => r.join(""));
    if (recs.includes(`domain-verify=${d.verify_token}`)) {
      await exec("UPDATE domains SET verified_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
      await audit(u.id, "domain.verify", d.hostname);
    }
  } catch {
    /* record not visible yet; the user can check again */
  }
  revalidatePath("/dashboard/domains");
}

export async function deleteDomainAction(id: number): Promise<void> {
  const u = await guard();
  await exec("DELETE FROM domains WHERE id = ? AND user_id = ?", [id, u.id]);
  revalidatePath("/dashboard/domains");
}

/* ---------- Link groups ---------- */

export async function createGroupAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await guard();
  const name = s(fd, "name").slice(0, 80);
  if (name.length < 2) return fail({ name: "Give the group a name." });
  await exec("INSERT INTO link_groups (user_id, name) VALUES (?, ?)", [u.id, name]);
  revalidatePath("/dashboard/links/groups");
  return done(`Created ${name}.`);
}

export async function deleteGroupAction(id: number): Promise<void> {
  const u = await guard();
  await exec("UPDATE links SET group_id = NULL WHERE group_id = ? AND user_id = ?", [id, u.id]);
  await exec("DELETE FROM link_groups WHERE id = ? AND user_id = ?", [id, u.id]);
  revalidatePath("/dashboard/links/groups");
}

export async function setLinkGroupAction(linkId: number, groupId: number | null): Promise<void> {
  const u = await guard();
  if (groupId && !(await queryOne("SELECT id FROM link_groups WHERE id = ? AND user_id = ?", [groupId, u.id]))) return;
  await exec("UPDATE links SET group_id = ? WHERE id = ? AND user_id = ?", [groupId, linkId, u.id]);
  revalidatePath("/dashboard/links/groups");
}

/* ---------- Teams ---------- */

export async function createTeamAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await guard();
  const name = s(fd, "name").slice(0, 80);
  if (name.length < 2) return fail({ name: "Give the workspace a name." });
  const res = await exec("INSERT INTO teams (name, owner_id) VALUES (?, ?)", [name, u.id]);
  await exec("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'owner')", [res.insertId, u.id]);
  revalidatePath("/dashboard/teams");
  return done(`Created ${name}.`);
}

async function ownsTeam(teamId: number, userId: number) {
  return !!(await queryOne("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND role = 'owner'", [teamId, userId]));
}

export async function addMemberAction(teamId: number, _: FormState, fd: FormData): Promise<FormState> {
  const u = await guard();
  if (!(await ownsTeam(teamId, u.id))) return fail({ form: "Only the owner can add people." });
  const email = s(fd, "email").toLowerCase();
  const role = s(fd, "role") === "viewer" ? "viewer" : "editor";
  const target = await queryOne<{ id: number }>("SELECT id FROM users WHERE email = ? AND status = 'active'", [email]);
  // Same message either way, so this form cannot be used to find out who has an account.
  if (!target) return fail({ email: "No active account uses that email. They need to register first." });
  await exec("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = IF(role = 'owner', role, VALUES(role))", [teamId, target.id, role]);
  revalidatePath("/dashboard/teams");
  return done("Added to the workspace.");
}

export async function removeMemberAction(teamId: number, userId: number): Promise<void> {
  const u = await guard();
  if (!(await ownsTeam(teamId, u.id)) && userId !== u.id) return;
  await exec("DELETE FROM team_members WHERE team_id = ? AND user_id = ? AND role <> 'owner'", [teamId, userId]);
  revalidatePath("/dashboard/teams");
}

export async function deleteTeamAction(teamId: number): Promise<void> {
  const u = await guard();
  if (!(await ownsTeam(teamId, u.id))) return;
  await exec("UPDATE links SET team_id = NULL WHERE team_id = ?", [teamId]);
  await exec("DELETE FROM teams WHERE id = ?", [teamId]);
  revalidatePath("/dashboard/teams");
}

export async function shareLinkWithTeamAction(linkId: number, teamId: number | null): Promise<void> {
  const u = await guard();
  if (teamId && !(await ownsTeam(teamId, u.id)) && !(await queryOne("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND role = 'editor'", [teamId, u.id]))) return;
  await exec("UPDATE links SET team_id = ? WHERE id = ? AND user_id = ?", [teamId, linkId, u.id]);
  revalidatePath("/dashboard/teams");
  revalidatePath("/dashboard/links");
}

/* ---------- Goals ---------- */

export async function createGoalAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await guard();
  const name = s(fd, "name").slice(0, 80);
  const [type, idRaw] = s(fd, "target").split(":");
  const id = Number(idRaw);
  if (name.length < 2) return fail({ name: "Name the goal, for example Newsletter signups." });
  if ((type !== "link" && type !== "block") || !Number.isInteger(id)) return fail({ target: "Pick what counts as a conversion." });
  const owns = type === "link"
    ? await queryOne("SELECT id FROM links WHERE id = ? AND user_id = ?", [id, u.id])
    : await queryOne("SELECT b.id FROM blocks b JOIN pages p ON p.id = b.page_id WHERE b.id = ? AND p.user_id = ?", [id, u.id]);
  if (!owns) return fail({ target: "That item is not yours." });
  await exec("INSERT INTO goals (user_id, name, entity_type, entity_id) VALUES (?, ?, ?, ?)", [u.id, name, type, id]);
  revalidatePath("/dashboard/goals");
  return done(`Goal "${name}" is now tracked.`);
}

export async function deleteGoalAction(id: number): Promise<void> {
  const u = await guard();
  await exec("DELETE FROM goals WHERE id = ? AND user_id = ?", [id, u.id]);
  revalidatePath("/dashboard/goals");
}

/* ---------- Contact messages ---------- */

export async function deleteMessageAction(id: number): Promise<void> {
  const u = await guard();
  await exec("DELETE FROM contact_messages WHERE id = ? AND user_id = ?", [id, u.id]);
  revalidatePath("/dashboard/contacts");
}

/* ---------- CSV import ---------- */

export async function importLinksAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await guard();
  if (!(await rateLimit(`import:${u.id}`, 10, 3600))) return fail({ form: "Too many imports this hour. Try again later." });
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail({ file: "Choose a CSV file." });
  if (file.size > 512 * 1024) return fail({ file: "Keep the file under 512 KB (about 3,000 rows)." });
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return fail({ file: "The file needs a header row and at least one link." });
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);
  if (col("target_url") < 0) return fail({ file: "The header row must include a target_url column." });
  const b = await getBrand();
  let ok = 0;
  const problems: string[] = [];
  for (const [i, r] of rows.slice(1, 501).entries()) {
    if (r.every((c) => !c.trim())) continue;
    const get = (n: string) => (col(n) >= 0 ? (r[col(n)] ?? "").trim() : "");
    const res = await createLink(u.id, b.host, {
      target_url: get("target_url"), slug: get("slug"), title: get("title"), expires_at: get("expires_at"), starts_at: get("starts_at"),
    });
    if (res.ok) ok++;
    else if (problems.length < 5) problems.push(`Row ${i + 2}: ${Object.values(res.errors)[0]}`);
  }
  await audit(u.id, "links.import", undefined, { ok, skipped: problems.length });
  revalidatePath("/dashboard/links");
  const skipped = rows.length - 1 - ok;
  if (ok === 0) return fail({ file: problems.join(" ") || "No links could be imported." });
  return done(`Imported ${ok} link${ok === 1 ? "" : "s"}.${skipped > 0 ? ` Skipped ${skipped}. ${problems.join(" ")}` : ""}`);
}

export async function listGroups(userId: number) {
  return query<{ id: number; name: string }>("SELECT id, name FROM link_groups WHERE user_id = ? ORDER BY name", [userId]);
}
