import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { phase2Enabled } from "@/lib/features";
import { ActionForm, ActionButton, ConfirmButton, CopyButton, Field } from "@/components/client";
import { addDomainAction, deleteDomainAction, verifyDomainAction } from "@/app/actions/phase2";

export const metadata = { title: "Domains" };
export const dynamic = "force-dynamic";

interface D { id: number; hostname: string; verify_token: string; verified_at: Date | null }

export default async function Domains() {
  if (!phase2Enabled()) notFound();
  const u = await requireUser();
  const b = await getBrand();
  const rows = await query<D>("SELECT id, hostname, verify_token, verified_at FROM domains WHERE user_id = ? ORDER BY id", [u.id]);
  return (
    <>
      <div className="page-head"><div><h1>Domains</h1><p>Serve your bio page from your own address. Short links work on it too, for example <span className="slug">links.example.com<b>/</b>launch</span>.</p></div></div>
      <div className="cols">
        <section>
          <ActionForm action={addDomainAction} submit="Connect domain" pendingLabel="Adding..." resetOnSuccess>
            <Field label="Domain" name="hostname" placeholder="links.example.com" hint="A subdomain works best. Point it at this server first." required />
          </ActionForm>
        </section>
        <section>
          {rows.length === 0 ? (
            <div className="empty"><h3>No domains yet</h3><p>Add one on the left and this page will show the DNS records to create.</p></div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {rows.map((d) => (
                <div key={d.id} className="panel">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong className="num">{d.hostname}</strong>
                    <span className={`badge ${d.verified_at ? "good" : "warn"}`}>{d.verified_at ? "Verified" : "Waiting for DNS"}</span>
                  </div>
                  {!d.verified_at && (
                    <table className="table" style={{ margin: "12px 0" }}>
                      <thead><tr><th>Type</th><th>Name</th><th>Value</th><th /></tr></thead>
                      <tbody>
                        <tr><td>CNAME or A</td><td className="num small">{d.hostname}</td><td className="num small">{b.host}</td><td /></tr>
                        <tr>
                          <td>TXT</td><td className="num small">_verify.{d.hostname}</td>
                          <td className="num small" style={{ overflowWrap: "anywhere" }}>domain-verify={d.verify_token}</td>
                          <td><CopyButton value={`domain-verify=${d.verify_token}`} /></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  <div className="row">
                    {!d.verified_at && <ActionButton action={verifyDomainAction.bind(null, d.id)}>Check DNS</ActionButton>}
                    <ConfirmButton action={deleteDomainAction.bind(null, d.id)} label="Remove" confirm={`Disconnect ${d.hostname}?`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <p className="small muted" style={{ marginTop: 24 }}>DNS changes can take up to a few hours. Your host also needs to accept the domain and issue its HTTPS certificate. See the deployment guide.</p>
    </>
  );
}
