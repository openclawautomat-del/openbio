import { CREDIT } from "@/lib/credit";
import { getSettings } from "@/lib/settings";
import { getBrand } from "@/lib/brand";
import { LANGUAGES } from "@/lib/i18n";
import { ActionForm, Field } from "@/components/client";
import {
  saveApiSettingsAction, saveBrandingAction, saveGeneralAction, saveIntegrationsAction, saveLegalAction,
} from "@/app/actions/admin";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Settings() {
  const [s, b] = await Promise.all([getSettings(), getBrand()]);
  const on = (k: string, d: boolean) => (s[k] === undefined ? d : s[k] === "1");
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p>Values saved here override the environment variables. Clear a field to fall back to the environment.</p></div></div>

      <section className="panel" id="branding">
        <h2 className="section-title">Branding</h2>
        <ActionForm action={saveBrandingAction} submit="Save branding" pendingLabel="Saving...">
          <div className="cols">
            <Field label="Site name" name="brand_name" defaultValue={s.brand_name ?? ""} placeholder={b.name} />
            <Field label="Tagline" name="brand_tagline" defaultValue={s.brand_tagline ?? ""} placeholder={b.tagline} />
          </div>
          <div className="cols">
            <Field label="Support email" name="brand_support_email" defaultValue={s.brand_support_email ?? ""} placeholder={b.supportEmail} />
            <Field label="Accent color" name="brand_primary" defaultValue={s.brand_primary ?? ""} placeholder={b.primary} hint="Hex, like #0b6e4f. Check contrast on white." />
          </div>
          <div className="cols">
            <Field label="Logo URL" name="brand_logo_url" defaultValue={s.brand_logo_url ?? ""} hint="Leave empty to show the site name as text." />
            <Field label="Favicon URL" name="brand_favicon_url" defaultValue={s.brand_favicon_url ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="f-brand_font">Heading font</label>
            <select id="f-brand_font" name="brand_font" className="input" defaultValue={s.brand_font ?? "grotesk"}>
              <option value="grotesk">Bricolage Grotesque (sans)</option>
              <option value="serif">Fraunces (serif)</option>
            </select>
          </div>
          <Field label="Footer text" name="brand_footer_text" defaultValue={s.brand_footer_text ?? ""} textarea rows={2} />
          <label className="row small"><input type="checkbox" name="brand_powered_by" defaultChecked={on("brand_powered_by", false)} /> Show a small &ldquo;Powered by {CREDIT.name}&rdquo; credit in the footer</label>
        </ActionForm>
      </section>

      <section className="panel" id="general" style={{ marginTop: 24 }}>
        <h2 className="section-title">General</h2>
        <ActionForm action={saveGeneralAction} submit="Save" pendingLabel="Saving...">
          <label className="row"><input type="checkbox" name="registration_enabled" defaultChecked={on("registration_enabled", true)} /> Allow new people to register</label>
          <label className="row"><input type="checkbox" name="require_email_verification" defaultChecked={on("require_email_verification", false)} /> Require email verification</label>
          <p className="small muted" style={{ margin: "0 0 16px" }}>Recommended for production. It needs a working mailbox under Email; without one, nobody could finish signing up.</p>
          <div className="field">
            <label htmlFor="f-default_language">Default language</label>
            <select id="f-default_language" name="default_language" className="input" defaultValue={s.default_language ?? "en"}>
              {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </ActionForm>
      </section>

      <section className="panel" id="api" style={{ marginTop: 24 }}>
        <h2 className="section-title">API</h2>
        <ActionForm action={saveApiSettingsAction} submit="Save limit" pendingLabel="Saving...">
          <Field label="Requests per minute, per API key" name="api_rate_limit" defaultValue={s.api_rate_limit ?? "60"} />
        </ActionForm>
      </section>

      <section className="panel" id="integrations" style={{ marginTop: 24 }}>
        <h2 className="section-title">Integrations</h2>
        <p className="small muted">Both are optional. Secrets are stored encrypted and are never shown again.</p>
        <ActionForm action={saveIntegrationsAction} submit="Save integrations" pendingLabel="Saving...">
          <h3>Google sign-in</h3>
          <p className="small muted">Redirect URI: <code>{b.url}/api/auth/google/callback</code></p>
          <div className="cols">
            <Field label="Client ID" name="google_client_id" defaultValue={s.google_client_id ?? ""} autoComplete="off" />
            <Field label="Client secret" name="google_client_secret" type="password" autoComplete="new-password" hint={s.google_client_secret ? "A secret is saved. Type a new one to replace it." : undefined} />
          </div>
          <label className="row small"><input type="checkbox" name="clear_google" /> Remove Google sign-in</label>
          <h3 style={{ marginTop: 24 }}>S3-compatible storage</h3>
          <p className="small muted">Without it, uploads go to the server disk.</p>
          <div className="cols">
            <Field label="Bucket" name="s3_bucket" defaultValue={s.s3_bucket ?? ""} />
            <Field label="Region" name="s3_region" defaultValue={s.s3_region ?? ""} placeholder="us-east-1" />
          </div>
          <Field label="Endpoint" name="s3_endpoint" defaultValue={s.s3_endpoint ?? ""} hint="Only for non-AWS services such as R2 or MinIO." />
          <div className="cols">
            <Field label="Access key" name="s3_key" defaultValue={s.s3_key ?? ""} autoComplete="off" />
            <Field label="Secret key" name="s3_secret" type="password" autoComplete="new-password" hint={s.s3_secret ? "A secret is saved. Type a new one to replace it." : undefined} />
          </div>
          <Field label="Public base URL" name="s3_public_url" defaultValue={s.s3_public_url ?? ""} hint="Where uploaded files are served from." />
          <label className="row small"><input type="checkbox" name="clear_s3" /> Remove S3 storage</label>
        </ActionForm>
      </section>

      <section className="panel" id="legal" style={{ marginTop: 24 }}>
        <h2 className="section-title">Legal pages</h2>
        <ActionForm action={saveLegalAction} submit="Save legal pages" pendingLabel="Saving...">
          <Field label="Terms of service" name="legal_terms" defaultValue={s.legal_terms ?? ""} textarea rows={10} hint="Plain text. Blank lines start a new paragraph. Empty uses the built-in text." />
          <Field label="Privacy policy" name="legal_privacy" defaultValue={s.legal_privacy ?? ""} textarea rows={10} />
        </ActionForm>
      </section>
    </>
  );
}
