import { query } from "@/lib/db";
import { ActionForm, ActionButton, ConfirmButton, Field } from "@/components/client";
import { addSlugListAction, removeSlugListAction, reviewAction, disableLinkAction, suspendOwnerAction, blocklistDestinationAction } from "@/app/actions/slugs";

export const metadata = { title: "Names and safety" };
export const dynamic = "force-dynamic";

interface L { id: number; kind: "reserved" | "brand" | "sensitive"; value: string }
interface Q { id: number; kind: "link" | "page"; slug: string; reason: string | null; owner_id: number; owner: string; target: string | null; created_at: Date }
interface F { id: number; slug: string; note: string | null; owner_id: number; owner: string; target_url: string }

const LISTS: { kind: L["kind"]; title: string; help: string; placeholder: string }[] = [
  { kind: "reserved", title: "Reserved names", help: "Nobody can register these as a short name or bio username. Every route of the app is reserved automatically.", placeholder: "billing" },
  { kind: "brand", title: "Protected brands", help: "A name equal to a brand, or a brand plus a sensitive word, is refused. Look-alikes such as paypa1 and rnicrosoft count. A name that merely contains a brand goes to the review queue.", placeholder: "revolut" },
  { kind: "sensitive", title: "Sensitive words", help: "Only matter next to a protected brand, for example paypal-login.", placeholder: "refund" },
];

export default async function Slugs() {
  const loaded = await Promise.all([
    query<L>("SELECT id, kind, value FROM slug_lists ORDER BY kind, value"),
    query<Q>(
      `SELECT l.id, 'link' AS kind, l.slug, l.review_reason AS reason, l.user_id AS owner_id, u.username AS owner, l.target_url AS target, l.created_at
         FROM links l JOIN users u ON u.id = l.user_id WHERE l.review_status = 'pending'
       UNION ALL
       SELECT p.id, 'page', u.username, p.review_reason, u.id, u.username, NULL, p.created_at
         FROM pages p JOIN users u ON u.id = p.user_id WHERE p.review_status = 'pending'
       ORDER BY created_at DESC LIMIT 100`,
    ),
    query<F>(
      `SELECT l.id, l.slug, l.safety_note AS note, l.user_id AS owner_id, u.username AS owner, l.target_url
         FROM links l JOIN users u ON u.id = l.user_id WHERE l.safety_status = 'flagged' ORDER BY l.checked_at DESC LIMIT 50`,
    ),
  ]).catch((e: Error) => e);
  if (loaded instanceof Error) {
    return (
      <div className="page-head"><div>
        <h1>Names and safety</h1>
        <div className="notice bad" role="alert">Could not read the lists: {loaded.message}. Run <span className="mono">npm run migrate</span> on the server (migration 004), then reload.</div>
      </div></div>
    );
  }
  const [lists, queue, flagged] = loaded;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Names and safety</h1>
          <p>Short names and bio usernames share one namespace. Clearly bad names are refused; suspicious ones wait here and stay inactive until you approve them.</p>
        </div>
      </div>

      <section aria-labelledby="queue-h" className="stack">
        <h2 id="queue-h" className="section-h">Review queue ({queue.length})</h2>
        {queue.length === 0 ? (
          <div className="empty"><h3>Nothing waiting</h3><p>Names that look like a brand or a known phishing pattern appear here for a decision.</p></div>
        ) : (
          <ul className="dom-list">
            {queue.map((q) => (
              <li className="dom" key={`${q.kind}-${q.id}`}>
                <div className="dom-head">
                  <strong className="mono dom-host">/{q.slug}</strong>
                  <span className="badge warn">{q.kind === "link" ? "Short link" : "Bio page"}</span>
                </div>
                <p className="small muted dom-line">By {q.owner}. {q.reason ?? "Flagged by the name rules."}</p>
                {q.target && <p className="small mono dom-line" style={{ overflowWrap: "anywhere" }}>{q.target}</p>}
                <div className="dom-actions">
                  <ActionButton action={reviewAction.bind(null, q.kind, q.id, "approved")} className="btn btn-sm btn-primary">Approve</ActionButton>
                  <ActionButton action={reviewAction.bind(null, q.kind, q.id, "rejected")}>Reject</ActionButton>
                  {q.kind === "link" && <ActionButton action={blocklistDestinationAction.bind(null, q.id)}>Block destination domain</ActionButton>}
                  <ConfirmButton action={suspendOwnerAction.bind(null, q.owner_id)} label={`Suspend ${q.owner}`} confirm={`Suspend ${q.owner}? They are signed out and their links and page stop working.`}>Suspend user</ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {flagged.length > 0 && (
        <section aria-labelledby="flag-h" className="stack" style={{ marginTop: 32 }}>
          <h2 id="flag-h" className="section-h">Destinations flagged by the re-check ({flagged.length})</h2>
          <ul className="dom-list">
            {flagged.map((f) => (
              <li className="dom" key={f.id}>
                <div className="dom-head"><strong className="mono dom-host">/{f.slug}</strong><span className="badge bad">Switched off</span></div>
                <p className="small muted dom-line">{f.note} Owner: {f.owner}.</p>
                <p className="small mono dom-line" style={{ overflowWrap: "anywhere" }}>{f.target_url}</p>
                <div className="dom-actions">
                  <ActionButton action={blocklistDestinationAction.bind(null, f.id)}>Block destination domain</ActionButton>
                  <ConfirmButton action={suspendOwnerAction.bind(null, f.owner_id)} label={`Suspend ${f.owner}`} confirm={`Suspend ${f.owner}?`}>Suspend user</ConfirmButton>
                  <ActionButton action={disableLinkAction.bind(null, f.id)}>Keep disabled</ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="cols" style={{ marginTop: 40 }}>
        {LISTS.map((cfg) => {
          const items = lists.filter((l) => l.kind === cfg.kind);
          return (
            <section key={cfg.kind} aria-labelledby={`l-${cfg.kind}`}>
              <h2 id={`l-${cfg.kind}`} className="section-h">{cfg.title}</h2>
              <p className="small muted" style={{ maxWidth: "52ch" }}>{cfg.help}</p>
              <ActionForm action={addSlugListAction.bind(null, cfg.kind)} submit="Add" pendingLabel="Adding..." resetOnSuccess>
                <Field label="Value" name="value" placeholder={cfg.placeholder} maxLength={64} required />
              </ActionForm>
              <ul className="chips">
                {items.map((i) => (
                  <li key={i.id} className="chip">
                    <span className="mono">{i.value}</span>
                    <ConfirmButton action={removeSlugListAction.bind(null, i.id)} label={`Remove ${i.value}`} confirm={`Remove ${i.value} from this list?`} className="chip-x">×</ConfirmButton>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
