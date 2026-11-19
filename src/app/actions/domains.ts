"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { domainService, invalidateDomains } from "@/lib/domains";
import type { FormState } from "@/components/client";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const refresh = () => { invalidateDomains(); revalidatePath("/admin/domains"); };

/** Every action re-checks the role against the database. Only a super admin ever reaches the service. */
export async function addDomainAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const r = await domainService().add(me.id, s(fd, "hostname"), s(fd, "label"));
  refresh();
  if (!r.ok) return { errors: { hostname: r.error } };
  return { ok: true, message: `Added ${r.data.hostname} as pending. Create the subdomain and install SSL in hPanel, then press Check & activate.` };
}

export async function editDomainAction(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const r = await domainService().edit(me.id, id, { hostname: s(fd, "hostname"), label: s(fd, "label") });
  refresh();
  if (!r.ok) return { errors: { hostname: r.error } };
  return { ok: true, message: r.data.status === "pending" ? "Saved. The domain is pending again, so run Check & activate." : "Saved." };
}

export async function checkDomainAction(id: number): Promise<void> {
  const me = await requireAdmin();
  await domainService().checkAndActivate(me.id, id);
  refresh();
}

/** Explicit admin override: activates even though the HTTPS check failed. Recorded in the audit log. */
export async function overrideActivateAction(id: number): Promise<void> {
  const me = await requireAdmin();
  await domainService().checkAndActivate(me.id, id, { override: true });
  refresh();
}

export async function disableDomainAction(id: number): Promise<void> {
  const me = await requireAdmin();
  await domainService().disable(me.id, id);
  refresh();
}

export async function deleteDomainAction(id: number): Promise<void> {
  const me = await requireAdmin();
  await domainService().remove(me.id, id);
  refresh();
}

export async function makeDefaultAction(id: number): Promise<FormState> {
  const me = await requireAdmin();
  const r = await domainService().makeDefault(me.id, id);
  refresh();
  revalidatePath("/", "layout"); // every cached URL is rebuilt from the new default
  if (!r.ok) return { errors: { form: r.error } };
  return { ok: true, message: `${r.data.next} is now the default domain.` };
}
