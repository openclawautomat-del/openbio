import fs from "node:fs/promises";
import { queryOne, query } from "@/lib/db";
import { StatRow } from "@/components/charts";
import { usageToday } from "@/lib/email/mailer";
import { uploadDir } from "@/lib/uploads";
import { phase2Enabled } from "@/lib/features";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const n = async (sql: string) => Number((await queryOne<{ n: number }>(sql))?.n ?? 0);

async function uploadsWritable() {
  try {
    await fs.mkdir(uploadDir(), { recursive: true });
    await fs.access(uploadDir(), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export default async function AdminHome() {
  const [users, links, pages, clicks, today, openReports, queued, failed, usage, boxes, up] = await Promise.all([
    n("SELECT COUNT(*) AS n FROM users"),
    n("SELECT COUNT(*) AS n FROM links"),
    n("SELECT COUNT(*) AS n FROM pages WHERE published = 1"),
    n("SELECT COUNT(*) AS n FROM clicks"),
    n("SELECT COUNT(*) AS n FROM clicks WHERE created_at >= UTC_DATE()"),
    n("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    n("SELECT COUNT(*) AS n FROM email_queue WHERE status IN ('queued','sending')"),
    n("SELECT COUNT(*) AS n FROM email_queue WHERE status = 'failed' AND created_at > UTC_TIMESTAMP() - INTERVAL 7 DAY"),
    usageToday(),
    query<{ type: string; daily_limit: number; enabled: number }>("SELECT type, daily_limit, enabled FROM mailboxes"),
    uploadsWritable(),
  ]);
  const sentToday = Object.values(usage).reduce((a, b) => a + b, 0);
  const near = boxes.filter((b) => b.enabled && (usage[b.type] ?? 0) >= b.daily_limit * 0.8);
  const secretOk = (process.env.AUTH_SECRET ?? "").length >= 32;
  const hasBox = boxes.some((b) => b.enabled);
  const health: { label: string; ok: boolean; note: string }[] = [
    { label: "Database", ok: true, note: "Connected" },
    { label: "Uploads folder", ok: up, note: up ? "Writable" : `Cannot write to ${uploadDir()}` },
    { label: "Email", ok: hasBox, note: hasBox ? `${boxes.length} mailbox${boxes.length === 1 ? "" : "es"} configured` : "No mailbox yet. Verification and reset emails are off." },
    { label: "Secret key", ok: secretOk, note: secretOk ? "Set" : "AUTH_SECRET is missing or shorter than 32 characters" },
    { label: "Public URL", ok: !/localhost/.test(process.env.APP_URL ?? "localhost"), note: process.env.APP_URL || "APP_URL is not set" },
    { label: "Phase 2 features", ok: true, note: phase2Enabled() ? "Enabled" : "Disabled with FEATURE_PHASE2=0" },
  ];
  return (
    <>
      <div className="page-head"><div><h1>Overview</h1><p>What is happening on this server.</p></div></div>
      <StatRow items={[{ label: "Users", value: users }, { label: "Short links", value: links }, { label: "Published pages", value: pages }, { label: "Clicks today", value: today }]} />
      {near.length > 0 && (
        <div className="notice warn" role="status" style={{ marginTop: 24 }}>
          {near.map((b) => `The ${b.type} mailbox is at ${usage[b.type] ?? 0} of ${b.daily_limit} emails today`).join(". ")}. Extra emails wait until tomorrow.
        </div>
      )}
      <div className="cols" style={{ marginTop: 40 }}>
        <section>
          <h2 className="section-title">System health</h2>
          <table className="table">
            <tbody>
              {health.map((h) => (
                <tr key={h.label}>
                  <td style={{ width: 140 }}>{h.label}</td>
                  <td><span className={`badge ${h.ok ? "good" : "warn"}`}>{h.ok ? "OK" : "Check"}</span></td>
                  <td className="small muted">{h.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="section-title">Activity</h2>
          <table className="table">
            <tbody>
              <tr><td>Emails sent today</td><td className="num">{sentToday}</td></tr>
              <tr><td>Waiting to send</td><td className="num">{queued}</td></tr>
              <tr><td>Failed in the last 7 days</td><td className="num">{failed}</td></tr>
              <tr><td>Open abuse reports</td><td className="num">{openReports}</td></tr>
              <tr><td>Total clicks recorded</td><td className="num">{clicks.toLocaleString("en-US")}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
