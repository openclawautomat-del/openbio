import { SiteShell } from "@/components/site-shell";
import { ActionForm, Field } from "@/components/client";
import { reportAction } from "@/app/actions/public";

export const metadata = { title: "Report abuse" };

export default async function Report({ searchParams }: { searchParams: Promise<{ target?: string }> }) {
  const { target } = await searchParams;
  return (
    <SiteShell>
      <h1>Report abuse</h1>
      <p className="prose" style={{ marginBottom: 24 }}>
        Found a short link or page that sends people to spam, phishing, malware or anything illegal? Tell us which one and an administrator will look at it.
      </p>
      <ActionForm action={reportAction} submit="Send report" pendingLabel="Sending...">
        <Field label="Short link or page" name="target" defaultValue={target ?? ""} placeholder="https://example.com/abc or just abc" hint="Paste the address or the part after the slash." required />
        <div className="field">
          <label htmlFor="reason">What is wrong with it?</label>
          <select className="input" id="reason" name="reason" defaultValue="spam">
            <option value="spam">Spam</option>
            <option value="phishing">Phishing or scam</option>
            <option value="malware">Malware</option>
            <option value="illegal">Illegal content</option>
            <option value="other">Something else</option>
          </select>
        </div>
        <Field label="Details" name="details" textarea rows={4} maxLength={1000} hint="Optional. Anything that helps us check it." />
      </ActionForm>
    </SiteShell>
  );
}
