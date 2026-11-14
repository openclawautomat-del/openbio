import { requireUser } from "@/lib/auth";
import { ActionForm, Field } from "@/components/client";
import { LANGUAGES } from "@/lib/i18n";
import { changeEmailAction, changePasswordAction, deleteAccountAction, saveLanguageAction } from "@/app/actions/app";

export const metadata = { title: "Account" };

export default async function Account() {
  const user = await requireUser();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p>Signed in as <strong>{user.username}</strong>.</p>
        </div>
      </div>
      <div style={{ maxWidth: 520, display: "grid", gap: 40 }}>
        <section>
          <h2 className="section-title">Email</h2>
          <ActionForm action={changeEmailAction} submit="Update email" pendingLabel="Saving...">
            <Field label="Email address" name="email" type="email" defaultValue={user.email} autoComplete="email" required />
            <Field label="Current password" name="password" type="password" autoComplete="current-password" required />
          </ActionForm>
        </section>
        <section>
          <h2 className="section-title">Password</h2>
          <ActionForm action={changePasswordAction} submit="Change password" pendingLabel="Saving..." resetOnSuccess>
            <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
            <Field label="New password" name="password" type="password" autoComplete="new-password" hint="10+ characters with a letter and a number." required />
          </ActionForm>
        </section>
        <section>
          <h2 className="section-title">Language</h2>
          <ActionForm action={saveLanguageAction} submit="Save language">
            <div className="field">
              <label htmlFor="f-language">Interface language</label>
              <select id="f-language" name="language" className="input" defaultValue={user.language}>
                {Object.entries(LANGUAGES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </div>
          </ActionForm>
        </section>
        <section>
          <h2 className="section-title">Delete account</h2>
          <p className="small muted">This removes your bio page, short links, QR codes and analytics for good. Short links will stop redirecting.</p>
          <ActionForm action={deleteAccountAction} submit="Delete my account" pendingLabel="Deleting..." submitClass="btn btn-danger">
            <Field label={`Type "${user.username}" to confirm`} name="confirm" autoComplete="off" required />
            <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          </ActionForm>
        </section>
      </div>
    </>
  );
}
