import { query } from "@/lib/db";
import { EMAIL_TYPES, usageToday } from "@/lib/email/mailer";
import { ActionForm, ActionButton, ConfirmButton, Field } from "@/components/client";
import {
  clearFailedEmailAction, deleteMailboxAction, retryEmailAction, saveMailboxAction, testMailboxAction,
} from "@/app/actions/admin";

export const metadata = { title: "Email" };
export const dynamic = "force-dynamic";

interface M { type: string; host: string; port: number; secure: number; username: string; from_name: string | null; from_email: string | null; daily_limit: number; enabled: number }
interface Q { id: number; type: string; to_email: string; subject: string; status: string; attempts: number; next_attempt_at: Date | null; mailbox_used: string | null; last_error: string | null; created_at: Date }

const LABELS: Record<string, string> = {
  default: "Default (used when a type has no mailbox of its own)",
  verification: "Verification", password_reset: "Password reset", welcome: "Welcome", security_alert: "Security alerts",
  notification: "Notifications", contact_form: "Contact form", report_export: "Report exports", marketing: "Marketing",
};

function MailboxForm({ type, m, sent }: { type: string; m?: M; sent: number }) {
  const limit = m?.daily_limit ?? 100;
  const pct = Math.min(100, Math.round((sent / limit) * 100));
  return (
    <details className="panel" open={type === "default" && !m}>
      <summary style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <strong>{LABELS[type]}</strong>
        {m ? <span className={`badge ${m.enabled ? "good" : ""}`}>{m.enabled ? "On" : "Paused"}</span> : <span className="badge">{type === "default" ? "Not set" : "Uses default"}</span>}
        {m && <span className="small muted num">{sent} of {limit} sent today</span>}
      </summary>
      {m && (
        <div className={`meter ${pct >= 100 ? "full" : pct >= 80 ? "warn" : ""}`} role="img" aria-label={`${pct}% of today's limit used`} style={{ margin: "12px 0" }}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      {m && pct >= 80 && <div className="notice warn">{pct >= 100 ? "Daily limit reached. New emails wait until tomorrow." : "Close to the daily limit."}</div>}
      <ActionForm action={saveMailboxAction} submit="Save mailbox" pendingLabel="Saving..." extra={m && <ConfirmButton action={deleteMailboxAction.bind(null, type)} label="Remove" confirm={`Remove the ${LABELS[type]} mailbox?`} />}>
        <input type="hidden" name="type" value={type} />
        <div className="cols">
          <Field label="SMTP host" name="host" defaultValue={m?.host} placeholder="smtp.hostinger.com" required />
          <Field label="Port" name="port" defaultValue={m?.port ?? 465} required />
        </div>
        <div className="cols">
          <Field label="Login" name="username" defaultValue={m?.username} autoComplete="off" required />
          <Field label="Password" name="password" type="password" autoComplete="new-password" hint={m ? "Leave empty to keep the saved password." : undefined} />
        </div>
        <div className="cols">
          <Field label="Sender name" name="from_name" defaultValue={m?.from_name} hint="Defaults to your site name." />
          <Field label="Sender address" name="from_email" defaultValue={m?.from_email} hint="Defaults to the login." />
        </div>
        <Field label="Daily limit" name="daily_limit" defaultValue={limit} hint="Emails over this number wait for the next day." />
        <label className="row small"><input type="checkbox" name="secure" defaultChecked={m ? !!m.secure : true} /> Use SSL (port 465)</label>
        <label className="row small"><input type="checkbox" name="enabled" defaultChecked={m ? !!m.enabled : true} /> Enabled</label>
      </ActionForm>
    </details>
  );
}

export default async function EmailAdmin() {
  const [boxes, usage, queue] = await Promise.all([
    query<M>("SELECT type, host, port, secure, username, from_name, from_email, daily_limit, enabled FROM mailboxes"),
    usageToday(),
    query<Q>("SELECT id, type, to_email, subject, status, attempts, next_attempt_at, mailbox_used, last_error, created_at FROM email_queue ORDER BY id DESC LIMIT 50"),
  ]);
  const by = new Map(boxes.map((b) => [b.type, b]));
  const failed = queue.filter((q) => q.status === "failed").length;
  return (
    <>
      <div className="page-head"><div><h1>Email</h1><p>Each kind of email can use its own mailbox. Anything without one falls back to the default, and with no default, email stays off.</p></div></div>
      {boxes.length === 0 && <div className="notice warn">No mailbox is set up. Password resets and verification emails cannot be sent until you add the default one.</div>}
      <div style={{ display: "grid", gap: 12 }}>
        {["default", ...EMAIL_TYPES].map((t) => <MailboxForm key={t} type={t} m={by.get(t)} sent={usage[t] ?? 0} />)}
      </div>

      <h2 className="section-title" style={{ marginTop: 40 }}>Send a test</h2>
      <ActionForm action={testMailboxAction} submit="Send test" pendingLabel="Sending...">
        <div className="cols">
          <Field label="Send to" name="to" type="email" placeholder="you@example.com" required />
          <div className="field">
            <label htmlFor="f-test-type">Mailbox</label>
            <select id="f-test-type" name="type" className="input" defaultValue="verification">
              {EMAIL_TYPES.map((t) => <option key={t} value={t}>{LABELS[t]}</option>)}
            </select>
          </div>
        </div>
      </ActionForm>

      <h2 className="section-title" style={{ marginTop: 40 }}>Recent emails</h2>
      {failed > 0 && <div style={{ marginBottom: 12 }}><ConfirmButton action={clearFailedEmailAction} label="Clear failed" confirm="Delete all failed emails from the log?" /></div>}
      {queue.length === 0 ? (
        <div className="empty"><h3>No email sent yet</h3><p>Sent and waiting emails are listed here.</p></div>
      ) : (
        <table className="table">
          <thead><tr><th>When (UTC)</th><th>To</th><th>Type</th><th>Status</th><th>Detail</th><th /></tr></thead>
          <tbody>
            {queue.map((e) => (
              <tr key={e.id}>
                <td className="small num">{new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="small" style={{ overflowWrap: "anywhere" }}>{e.to_email}</td>
                <td className="small">{LABELS[e.type] ?? e.type}</td>
                <td><span className={`badge ${e.status === "sent" ? "good" : e.status === "failed" ? "bad" : "warn"}`}>{e.status}</span></td>
                <td className="small muted" style={{ maxWidth: 280, overflowWrap: "anywhere" }}>
                  {e.last_error ?? (e.status === "queued" && e.attempts > 0 ? `Attempt ${e.attempts}, next try ${new Date(e.next_attempt_at ?? Date.now()).toISOString().slice(0, 16).replace("T", " ")}` : e.mailbox_used ? `via ${e.mailbox_used}` : "")}
                </td>
                <td style={{ textAlign: "right" }}>{e.status === "failed" && <ActionButton action={retryEmailAction.bind(null, e.id)}>Retry</ActionButton>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
