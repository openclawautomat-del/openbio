import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { phase2Enabled } from "@/lib/features";
import { ActionForm, ConfirmButton, Field } from "@/components/client";
import { createGoalAction, deleteGoalAction } from "@/app/actions/phase2";

export const metadata = { title: "Goals" };
export const dynamic = "force-dynamic";

interface G { id: number; name: string; entity_type: "link" | "block"; entity_id: number; label: string | null; d7: number; d30: number; views30: number }

export default async function Goals({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!phase2Enabled()) notFound();
  const u = await requireUser();
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const goals = await query<G>(
    `SELECT g.id, g.name, g.entity_type, g.entity_id,
            COALESCE(l.slug, b.title) AS label,
            (SELECT COUNT(*) FROM clicks c WHERE c.entity_type = g.entity_type AND c.entity_id = g.entity_id AND c.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)) AS d7,
            (SELECT COUNT(*) FROM clicks c WHERE c.entity_type = g.entity_type AND c.entity_id = g.entity_id AND c.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${days} DAY)) AS d30,
            (SELECT COUNT(*) FROM clicks v WHERE v.entity_type = 'page' AND v.user_id = g.user_id AND v.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${days} DAY)) AS views30
       FROM goals g
       LEFT JOIN links l ON g.entity_type = 'link' AND l.id = g.entity_id
       LEFT JOIN blocks b ON g.entity_type = 'block' AND b.id = g.entity_id
      WHERE g.user_id = ? ORDER BY g.id DESC`,
    [u.id],
  );
  const links = await query<{ id: number; slug: string }>("SELECT id, slug FROM links WHERE user_id = ? ORDER BY id DESC LIMIT 200", [u.id]);
  const blocks = await query<{ id: number; title: string | null; type: string }>(
    "SELECT b.id, b.title, b.type FROM blocks b JOIN pages p ON p.id = b.page_id WHERE p.user_id = ? AND b.type = 'link' ORDER BY b.sort_order LIMIT 200", [u.id],
  );
  return (
    <>
      <div className="page-head">
        <div><h1>Goals</h1><p>A goal counts clicks on one link or bio page button as a conversion, and compares it with how many people visited your page.</p></div>
        <div className="row small">{[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}`} aria-current={d === days}>{d} days</Link>)}</div>
      </div>
      <div className="cols">
        <section>
          <ActionForm action={createGoalAction} submit="Track goal" pendingLabel="Saving..." resetOnSuccess>
            <Field label="Goal name" name="name" placeholder="Newsletter signups" maxLength={80} required />
            <div className="field">
              <label htmlFor="f-target">Counts as a conversion when someone clicks</label>
              <select id="f-target" name="target" className="input" defaultValue="">
                <option value="" disabled>Choose a link or button</option>
                {links.length > 0 && <optgroup label="Short links">{links.map((l) => <option key={l.id} value={`link:${l.id}`}>/{l.slug}</option>)}</optgroup>}
                {blocks.length > 0 && <optgroup label="Bio page buttons">{blocks.map((b) => <option key={b.id} value={`block:${b.id}`}>{b.title || `Button ${b.id}`}</option>)}</optgroup>}
              </select>
            </div>
          </ActionForm>
        </section>
        <section>
          {goals.length === 0 ? (
            <div className="empty"><h3>No goals yet</h3><p>Pick the one click that matters most, such as the signup button, and its rate shows up here.</p></div>
          ) : (
            <table className="table">
              <thead><tr><th>Goal</th><th>7 days</th><th>{days} days</th><th>Rate</th><th /></tr></thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}<div className="small muted">{g.label ? (g.entity_type === "link" ? `/${g.label}` : g.label) : "Deleted item"}</div></td>
                    <td className="num">{Number(g.d7)}</td><td className="num">{Number(g.d30)}</td>
                    <td className="num">{Number(g.views30) > 0 ? `${((Number(g.d30) / Number(g.views30)) * 100).toFixed(1)}%` : "n/a"}</td>
                    <td style={{ textAlign: "right" }}><ConfirmButton action={deleteGoalAction.bind(null, g.id)} label="Delete" confirm={`Stop tracking ${g.name}?`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="small muted" style={{ marginTop: 12 }}>Rate is conversions divided by bio page visits in the same period. For a short link that is not on your page the rate is only a rough guide.</p>
        </section>
      </div>
    </>
  );
}
