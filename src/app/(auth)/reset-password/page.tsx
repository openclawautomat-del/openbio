import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, Field } from "@/components/client";
import { resetAction } from "@/app/actions/auth";
import { getT } from "@/lib/i18n";
import { sha256 } from "@/lib/crypto";
import { queryOne } from "@/lib/db";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = await getT();
  const { token = "" } = await searchParams;
  const valid = token
    ? await queryOne("SELECT 1 FROM auth_tokens WHERE token_hash = ? AND purpose = 'password_reset' AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()", [sha256(token)])
    : null;
  return (
    <AuthShell title={t("auth.reset.title")}>
      {valid ? (
        <ActionForm action={resetAction} submit={t("auth.reset.submit")} pendingLabel="Updating...">
          <>
              <input type="hidden" name="token" value={token} />
              <Field label={t("auth.password")} name="password" type="password" autoComplete="new-password" required hint={t("auth.passwordHint")} />
            </>
        </ActionForm>
      ) : (
        <>
          <div className="notice bad">{t("auth.reset.invalid")}</div>
          <Link href="/forgot-password">{t("auth.forgot.title")}</Link>
        </>
      )}
    </AuthShell>
  );
}
