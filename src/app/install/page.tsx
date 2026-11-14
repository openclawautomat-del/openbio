import { redirect } from "next/navigation";
import { ActionForm, Field } from "@/components/client";
import { installAction } from "@/app/actions/install";
import { dbConfigured, query } from "@/lib/db";
import { isInstalled } from "@/lib/install";
import { getBrand } from "@/lib/brand";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Install", robots: { index: false } };
export const dynamic = "force-dynamic";

async function checkDb(): Promise<{ ok: boolean; detail: string }> {
  if (!dbConfigured()) return { ok: false, detail: "DB_HOST, DB_NAME or DB_USER is not set." };
  try {
    const r = await query<{ v: string }>("SELECT VERSION() AS v");
    return { ok: true, detail: `Connected to MySQL ${r[0]?.v}` };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}

export default async function InstallPage() {
  if (await isInstalled()) redirect("/login");
  const [db, b] = [await checkDb(), await getBrand()];
  const secretOk = (process.env.AUTH_SECRET ?? "").length >= 16;
  return (
    <AuthShell title={`Set up ${b.name}`} sub="Three checks, one admin account. This page locks itself when it is done.">
      <div className={`notice ${db.ok ? "good" : "bad"}`} role="status">
        <strong>Database.</strong> {db.detail}
        {!db.ok && <div className="small">Set the DB_* variables in your environment (see .env.example) and restart the app.</div>}
      </div>
      {!secretOk && (
        <div className="notice bad" role="alert">
          <strong>Secret key.</strong> AUTH_SECRET is missing or shorter than 16 characters.
          <div className="small">Add AUTH_SECRET (a long random string, 32+ characters) to your environment variables and restart the app. Without it, logins and encrypted settings cannot work.</div>
        </div>
      )}
      {db.ok && secretOk && (
        <ActionForm action={installAction} submit="Install" pendingLabel="Running migrations...">
          <Field label="Admin email" name="email" type="email" autoComplete="email" required />
          <Field label="Admin username" name="username" prefix={`${b.host}/`} autoComplete="username" required maxLength={40} />
          <Field label="Admin password" name="password" type="password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." />
          <div className="field">
            <label htmlFor="f-lang">Default language</label>
            <select id="f-lang" name="lang" className="input" defaultValue="en">
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
          <label className="check"><input type="checkbox" name="registration" defaultChecked /> Let anyone register</label>
          <label className="check">
            <input type="checkbox" name="verify" /> Require email verification
            <span className="hint"> Recommended for production. Needs a working mailbox under Admin, Settings, Email; without one, sign-ups are not blocked.</span>
          </label>
        </ActionForm>
      )}
    </AuthShell>
  );
}
