import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, Field } from "@/components/client";
import { loginAction } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth";
import { ensureInstalled } from "@/lib/install";
import { getT } from "@/lib/i18n";
import { flag, getSetting } from "@/lib/settings";
import { safeNext } from "@/lib/validation";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; error?: string }> }) {
  await ensureInstalled();
  const sp = await searchParams;
  if (await currentUser()) redirect(safeNext(sp.next));
  const t = await getT();
  const open = await flag("registration_enabled", true);
  const google = Boolean(await getSetting("google_client_id"));
  return (
    <AuthShell title={t("auth.login.title")}>
      {sp.reset && <div className="notice good" role="status">Password updated. Sign in with the new one.</div>}
      {sp.error && (
        <div className="notice bad" role="alert">
          {{ google: "Google sign-in did not complete. Try again.", closed: "Registration is closed on this site.", suspended: "This account is suspended." }[sp.error] ?? "Sign-in failed."}
        </div>
      )}
      <ActionForm action={loginAction} submit={t("auth.login.submit")} pendingLabel="Signing in...">
        <>
            <input type="hidden" name="next" value={safeNext(sp.next, "")} />
            <Field label={t("auth.email")} name="email" type="email" autoComplete="email" required />
            <Field label={t("auth.password")} name="password" type="password" autoComplete="current-password" required />
          </>
      </ActionForm>
      {google && <p style={{ marginTop: 16 }}><a className="btn" href="/api/auth/google" style={{ width: "100%" }}>Continue with Google</a></p>}
      <p className="small" style={{ marginTop: 24 }}>
        <Link href="/forgot-password">{t("auth.login.forgot")}</Link>
        {open && <><br />{t("auth.login.noaccount")} <Link href="/register">{t("nav.signup")}</Link></>}
      </p>
    </AuthShell>
  );
}
