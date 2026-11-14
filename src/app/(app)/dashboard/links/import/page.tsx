import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { phase2Enabled } from "@/lib/features";
import { ActionForm } from "@/components/client";
import { importLinksAction } from "@/app/actions/phase2";

export const metadata = { title: "Import links" };

export default async function ImportLinks() {
  if (!phase2Enabled()) notFound();
  await requireUser();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Import links</h1>
          <p>Bring in short links from a CSV file. Up to 500 rows and 512 KB per file. <Link href="/dashboard/links">Back to links</Link></p>
        </div>
      </div>
      <div className="cols">
        <section>
          <ActionForm action={importLinksAction} submit="Import file" pendingLabel="Importing...">
            <div className="field">
              <label htmlFor="f-file">CSV file</label>
              <input id="f-file" name="file" type="file" accept=".csv,text/csv" className="input" required />
            </div>
          </ActionForm>
        </section>
        <section>
          <h2 className="section-title">Expected columns</h2>
          <table className="table">
            <thead><tr><th>Column</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td className="slug">target_url</td><td>Required. Must be http or https.</td></tr>
              <tr><td className="slug">slug</td><td>Optional. A random one is made if empty or taken.</td></tr>
              <tr><td className="slug">title</td><td>Optional.</td></tr>
              <tr><td className="slug">starts_at</td><td>Optional, UTC, like 2026-01-31 09:00.</td></tr>
              <tr><td className="slug">expires_at</td><td>Optional, UTC, same format.</td></tr>
            </tbody>
          </table>
          <pre className="code" style={{ marginTop: 12 }}>{`target_url,slug,title
https://example.com/spring,spring,Spring sale
https://example.com/docs,,Docs`}</pre>
          <p className="small muted">Rows that fail are skipped and reported, so a partly bad file still imports the good rows.</p>
        </section>
      </div>
    </>
  );
}
