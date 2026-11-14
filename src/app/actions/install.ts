"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { dbConfigured, query } from "@/lib/db";
import { runMigrations } from "@/lib/migrate";
import { isInstalled } from "@/lib/install";
import { emailSchema, passwordSchema, slugSchema, fieldErrors } from "@/lib/validation";
import { createUser } from "@/lib/services/users";
import { createSession, audit } from "@/lib/auth";
import { setSettings } from "@/lib/settings";
import { rateLimit } from "@/lib/ratelimit";
import { ipHash } from "@/lib/crypto";
import { reqInfo } from "@/lib/request";
import type { FormState } from "@/components/client";

const schema = z.object({
  email: emailSchema,
  username: slugSchema,
  password: passwordSchema,
  lang: z.enum(["en", "es"]).default("en"),
});

export async function installAction(_: FormState, fd: FormData): Promise<FormState> {
  if (await isInstalled()) return { errors: { form: "This site is already installed." } };
  if (!dbConfigured()) return { errors: { form: "Database settings are missing. Set DB_HOST, DB_NAME, DB_USER and DB_PASSWORD, then restart the app." } };
  const info = await reqInfo();
  if (!(await rateLimit(`install:${ipHash(info.ip)}`, 10, 3600).catch(() => true))) return { errors: { form: "Too many attempts. Try again later." } };

  const parsed = schema.safeParse({
    email: String(fd.get("email") ?? "").trim().toLowerCase(),
    username: String(fd.get("username") ?? "").trim().toLowerCase(),
    password: String(fd.get("password") ?? ""),
    lang: String(fd.get("lang") ?? "en"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  try {
    await runMigrations({ includePhase2: process.env.FEATURE_PHASE2 !== "0" });
  } catch (e) {
    return { errors: { form: `Migrations failed: ${(e as Error).message}` } };
  }
  const [{ n }] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  if (n > 0) return { errors: { form: "Users already exist in this database. Use an empty database for a fresh install." } };

  const id = await createUser({ ...parsed.data, role: "super_admin", verified: true });
  await setSettings({
    default_language: parsed.data.lang,
    require_email_verification: fd.get("verify") ? "1" : "0",
    registration_enabled: fd.get("registration") ? "1" : "0",
    installed: "1",
  });
  (globalThis as unknown as { __installed?: boolean }).__installed = true;
  await audit(id, "install", String(id));
  await createSession(id);
  redirect("/admin/settings?welcome=1");
}
