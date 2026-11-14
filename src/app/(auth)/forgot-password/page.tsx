import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, Field } from "@/components/client";
import { forgotAction } from "@/app/actions/auth";
import { ensureInstalled } from "@/lib/install";
import { getT } from "@/lib/i18n";
import { emailAvailable } from "@/lib/email/mailer";

export const metadata = { title: "Reset password" };

export default async function ForgotPage() {
  await ensureInstalled();
  const t = await getT();
  const enabled = await emailAvailable("password_reset");
  return (
    <AuthShell title={t("auth.forgot.title")} sub={enabled ? "Enter the email you registered with and we will send a reset link." : undefined}>
      {enabled ? (
        <ActionForm action={forgotAction} submit={t("auth.forgot.submit")} pendingLabel="Sending...">
          <Field label={t("auth.email")} name="email" type="email" autoComplete="email" required />
        </ActionForm>
      ) : (
        <div className="notice warn">{t("auth.forgot.disabled")}</div>
      )}
      <p className="small" style={{ marginTop: 24 }}><Link href="/login">{t("nav.signin")}</Link></p>
    </AuthShell>
  );
}
