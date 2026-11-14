import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, Field } from "@/components/client";
import { registerAction } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth";
import { ensureInstalled } from "@/lib/install";
import { getT } from "@/lib/i18n";
import { flag } from "@/lib/settings";
import { getBrand } from "@/lib/brand";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  await ensureInstalled();
  if (await currentUser()) redirect("/dashboard");
  const t = await getT();
  const b = await getBrand();
  if (!(await flag("registration_enabled", true))) {
    return (
      <AuthShell title={t("auth.register.title")}>
        <div className="notice warn">{t("auth.register.closed")}</div>
        <Link href="/login">{t("nav.signin")}</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("auth.register.title")}>
      <ActionForm action={registerAction} submit={t("auth.register.submit")} pendingLabel="Creating account...">
        <>
            <Field label={t("auth.register.username")} name="username" prefix={`${b.host}/`} autoComplete="username" required hint={t("auth.register.usernameHint")} maxLength={40} />
            <Field label={t("auth.email")} name="email" type="email" autoComplete="email" required />
            <Field label={t("auth.password")} name="password" type="password" autoComplete="new-password" required hint={t("auth.passwordHint")} />
          </>
      </ActionForm>
      <p className="small" style={{ marginTop: 24 }}>{t("auth.register.have")} <Link href="/login">{t("nav.signin")}</Link></p>
    </AuthShell>
  );
}
