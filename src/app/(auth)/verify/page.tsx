import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { exec } from "@/lib/db";
import { consumeToken } from "@/lib/services/users";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ResendButton } from "./resend";

export const metadata = { title: "Confirm email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const t = await getT();
  const { token } = await searchParams;
  const user = await currentUser();
  if (token) {
    const uid = await consumeToken(token, "verify_email");
    if (uid) {
      await exec("UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE id = ? AND email_verified_at IS NULL", [uid]);
      return (
        <AuthShell title={t("auth.verify.done")}>
          <Link className="btn btn-primary" href="/dashboard">Open dashboard</Link>
        </AuthShell>
      );
    }
    return (
      <AuthShell title={t("auth.verify.invalid")}>
        {user ? <ResendButton /> : <Link href="/login">{t("nav.signin")}</Link>}
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Check your inbox" sub={t("auth.verify.banner")}>
      {user ? <ResendButton /> : <Link href="/login">{t("nav.signin")}</Link>}
    </AuthShell>
  );
}
