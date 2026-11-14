import { query } from "@/lib/db";
import { ActionForm, ActionButton, Field } from "@/components/client";
import { addBlockAction, removeBlockAction } from "@/app/actions/admin";

export const metadata = { title: "Blocklist" };
export const dynamic = "force-dynamic";

interface B { id: number; kind: "domain" | "keyword"; value: string; created_at: Date }

export default async function Blocklist() {
  const rows = await query<B>("SELECT id, kind, value, created_at FROM blocklist ORDER BY kind, value");
  return (
    <>
      <div className="page-head"><div><h1>Blocklist</h1><p>Links to a blocked domain are refused, and so are slugs or titles that contain a blocked keyword.</p></div></div>
      <div className="cols">
        <section>
          <ActionForm action={addBlockAction} submit="Block" pendingLabel="Blocking..." resetOnSuccess>
            <div className="field">
              <label htmlFor="f-kind">Type</label>
              <select id="f-kind" name="kind" className="input" defaultValue="domain">
                <option value="domain">Domain (also blocks subdomains)</option>
                <option value="keyword">Keyword</option>
              </select>
            </div>
            <Field label="Value" name="value" placeholder="spam-example.com" required />
          </ActionForm>
        </section>
        <section>
          {rows.length === 0 ? (
            <div className="empty"><h3>Nothing blocked</h3><p>Add a domain when a report shows a link to a scam or malware site.</p></div>
          ) : (
            <table className="table">
              <thead><tr><th>Value</th><th>Type</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num">{r.value}</td>
                    <td>{r.kind === "domain" ? "Domain" : "Keyword"}</td>
                    <td style={{ textAlign: "right" }}><ActionButton action={removeBlockAction.bind(null, r.id)} label={`Unblock ${r.value}`}>Unblock</ActionButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
