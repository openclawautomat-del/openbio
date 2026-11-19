import { domainService, appOrigin } from "@/lib/domains";
import { ActionForm, ActionButton, ConfirmDialog, ConfirmButton, Field } from "@/components/client";
import {
  addDomainAction, editDomainAction, checkDomainAction, overrideActivateAction,
  disableDomainAction, deleteDomainAction, makeDefaultAction,
} from "@/app/actions/domains";
import type { DomainRow } from "@/lib/domain-service";

export const metadata = { title: "Domains" };
export const dynamic = "force-dynamic";

const STATUS: Record<DomainRow["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "good" },
  pending: { label: "Pending", cls: "warn" },
  disabled: { label: "Disabled", cls: "" },
};

const when = (d: Date | null) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "never");

export default async function Domains() {
  const rows = await domainService().list();
  const current = rows.find((d) => d.is_default);
  const appHost = appOrigin().host;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Domains</h1>
          <p>Short links and bio pages are served only on the default domain. Every other active domain opens the dashboard, admin and API, and returns 404 for public content.</p>
        </div>
      </div>

      <div className="cols">
        <section aria-labelledby="add-h">
          <h2 id="add-h" className="section-h">Add a domain</h2>
          <ActionForm action={addDomainAction} submit="Add domain" pendingLabel="Adding..." resetOnSuccess>
            <Field label="Domain" name="hostname" placeholder="go.example.com" hint="The exact subdomain you created, without https://." required />
            <Field label="Label (optional)" name="label" placeholder="Short links" maxLength={80} />
          </ActionForm>
          <ol className="steps small">
            <li>In Hostinger hPanel, create the subdomain and point it at this Node.js app.</li>
            <li>Install SSL for that subdomain in hPanel. This app never issues certificates.</li>
            <li>Add it here. It stays <b>pending</b> until Check &amp; activate reaches <span className="mono">https://domain/api/health</span> with a valid certificate.</li>
            <li>When you are ready to switch, make it the default.</li>
          </ol>
        </section>

        <section aria-labelledby="list-h">
          <h2 id="list-h" className="section-h">Your domains</h2>
          {rows.length === 0 ? (
            <div className="empty"><h3>No domains yet</h3><p>Open any page of the app and the address from APP_URL is added as the default automatically.</p></div>
          ) : (
            <ul className="dom-list">
              {rows.map((d) => {
                const st = STATUS[d.status];
                return (
                  <li key={d.id} className="dom">
                    <div className="dom-head">
                      <strong className="mono dom-host">{d.hostname}</strong>
                      <span className="row wrap" style={{ gap: 6 }}>
                        {d.is_default && <span className="badge good">Default</span>}
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                        {d.hostname === appHost && <span className="badge">APP_URL</span>}
                      </span>
                    </div>
                    {d.label && <p className="small muted dom-line">{d.label}</p>}
                    <p className="small muted dom-line">
                      {d.last_check_at ? `Last check ${when(d.last_check_at)}: ${d.last_check_ok ? "passed" : "failed"}.` : "Not checked yet."}
                      {d.override_by ? " Activated by admin override." : ""}
                    </p>
                    {d.last_check_ok === false && d.last_check_error && <div className="notice bad dom-line" role="status">{d.last_check_error}</div>}

                    <div className="dom-actions">
                      {d.status !== "active" && <ActionButton action={checkDomainAction.bind(null, d.id)} className="btn btn-sm btn-primary">Check &amp; activate</ActionButton>}
                      {d.status === "pending" && d.last_check_ok === false && (
                        <ConfirmDialog trigger="Activate anyway" title={`Activate ${d.hostname} without a passing check?`} confirmLabel="Activate anyway" action={overrideActivateAction.bind(null, d.id)}>
                          <p>The HTTPS check failed: {d.last_check_error}</p>
                          <p>If you activate it anyway, visitors may see certificate warnings or errors on this domain. The override is recorded in the audit log.</p>
                        </ConfirmDialog>
                      )}
                      {d.status === "active" && !d.is_default && (
                        <ConfirmDialog
                          trigger="Make default" title={`Make ${d.hostname} the default domain?`} confirmLabel="Make default"
                          action={makeDefaultAction.bind(null, d.id)} triggerClass="btn btn-sm btn-primary"
                        >
                          <p>Short links and bio pages will be served only on <b className="mono">{d.hostname}</b> from now on.</p>
                          <p><b>Old URLs and printed QR codes on {current ? <span className="mono">{current.hostname}</span> : "the previous domain"} will stop working</b> and show a 404. Nothing is redirected and no links are changed or deleted.</p>
                          <p>Dashboard, admin and API stay reachable on every active domain.</p>
                        </ConfirmDialog>
                      )}
                      {d.status === "active" && !d.is_default && <ActionButton action={disableDomainAction.bind(null, d.id)}>Disable</ActionButton>}
                      {d.status === "active" && <ActionButton action={checkDomainAction.bind(null, d.id)}>Re-check</ActionButton>}
                      {!d.is_default && (
                        <ConfirmButton action={deleteDomainAction.bind(null, d.id)} label={`Delete ${d.hostname}`} confirm={`Delete ${d.hostname}? Links and pages are not affected.`}>Delete</ConfirmButton>
                      )}
                    </div>
                    {d.is_default && <p className="small muted dom-line">The default domain cannot be disabled or deleted. Make another active domain the default first.</p>}

                    <details className="edit dom-line">
                      <summary className="small link-like">Edit</summary>
                      <ActionForm action={editDomainAction.bind(null, d.id)} submit="Save" pendingLabel="Saving...">
                        <Field label="Domain" name="hostname" defaultValue={d.hostname} required hint={d.is_default ? "The default domain's address is locked." : "Changing the address makes the domain pending again."} />
                        <Field label="Label" name="label" defaultValue={d.label ?? ""} maxLength={80} />
                      </ActionForm>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
