import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { ApiKeyForm } from "@/components/api-key-form";
import { ConfirmButton } from "@/components/client";
import { revokeApiKeyAction } from "@/app/actions/app";

export const metadata = { title: "API keys" };

interface Key { id: number; name: string; prefix: string; last_used_at: Date | null; revoked_at: Date | null; created_at: Date }
const fmt = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "Never");

export default async function ApiPage() {
  const user = await requireUser();
  const b = await getBrand();
  const keys = await query<Key>("SELECT id, name, prefix, last_used_at, revoked_at, created_at FROM api_keys WHERE user_id = ? ORDER BY id DESC", [user.id]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>API keys</h1>
          <p>Create short links and read stats from your own scripts. See the <Link href="/docs">API reference</Link>.</p>
        </div>
      </div>
      <div className="cols" style={{ gridTemplateColumns: "minmax(0, 6fr) minmax(0, 4fr)", alignItems: "start" }}>
        <section>
          {keys.length === 0 ? (
            <div className="empty">
              <h3>No keys yet</h3>
              <p>Make one on the right, then send it as <code>Authorization: Bearer ob_...</code> to {b.url}/api/v1.</p>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Name</th><th>Key</th><th>Last used</th><th /></tr></thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}{k.revoked_at ? <> <span className="badge bad">Revoked</span></> : null}</td>
                    <td className="num">{k.prefix}...</td>
                    <td className="small muted">{fmt(k.last_used_at)}</td>
                    <td style={{ textAlign: "right" }}>
                      {k.revoked_at ? null : (
                        <ConfirmButton action={revokeApiKeyAction.bind(null, k.id)} label="Revoke" confirm={`Revoke "${k.name}"? Anything using it stops working immediately.`} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel">
          <h2 className="section-title">New key</h2>
          <ApiKeyForm />
        </section>
      </div>
    </>
  );
}
