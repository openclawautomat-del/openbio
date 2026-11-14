import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { phase2Enabled } from "@/lib/features";
import { ActionForm, ConfirmButton, Field } from "@/components/client";
import { ShareLink } from "@/components/share-link";
import { addMemberAction, createTeamAction, deleteTeamAction, removeMemberAction } from "@/app/actions/phase2";

export const metadata = { title: "Teams" };
export const dynamic = "force-dynamic";

interface T { id: number; name: string; role: "owner" | "editor" | "viewer" }
interface Mem { user_id: number; username: string; email: string; role: string }

export default async function Teams() {
  if (!phase2Enabled()) notFound();
  const u = await requireUser();
  const teams = await query<T>(
    "SELECT t.id, t.name, m.role FROM teams t JOIN team_members m ON m.team_id = t.id WHERE m.user_id = ? ORDER BY t.name", [u.id],
  );
  const members = teams.length
    ? await query<Mem & { team_id: number }>(
        `SELECT m.team_id, m.user_id, u.username, u.email, m.role FROM team_members m JOIN users u ON u.id = m.user_id
          WHERE m.team_id IN (${teams.map(() => "?").join(",")}) ORDER BY m.role, u.username`, teams.map((t) => t.id))
    : [];
  const mine = await query<{ id: number; slug: string; team_id: number | null }>(
    "SELECT id, slug, team_id FROM links WHERE user_id = ? ORDER BY id DESC LIMIT 100", [u.id],
  );
  return (
    <>
      <div className="page-head"><div><h1>Teams</h1><p>A workspace lets others see and edit the links you share with it. Editors can change shared links; viewers can only look.</p></div></div>
      <section style={{ maxWidth: 420, marginBottom: 40 }}>
        <ActionForm action={createTeamAction} submit="Create workspace" pendingLabel="Creating..." resetOnSuccess>
          <Field label="Workspace name" name="name" placeholder="Marketing" maxLength={80} required />
        </ActionForm>
      </section>
      {teams.length === 0 ? (
        <div className="empty"><h3>No workspaces yet</h3><p>Create one, then add teammates by the email they registered with.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          {teams.map((t) => (
            <section key={t.id} className="panel">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 className="section-title" style={{ margin: 0 }}>{t.name} <span className="badge">{t.role}</span></h2>
                {t.role === "owner"
                  ? <ConfirmButton action={deleteTeamAction.bind(null, t.id)} label="Delete workspace" confirm={`Delete ${t.name}? Shared links go back to their owners.`} />
                  : <ConfirmButton action={removeMemberAction.bind(null, t.id, u.id)} label="Leave" confirm={`Leave ${t.name}?`} />}
              </div>
              <table className="table" style={{ margin: "12px 0" }}>
                <thead><tr><th>Member</th><th>Role</th><th /></tr></thead>
                <tbody>
                  {members.filter((m) => m.team_id === t.id).map((m) => (
                    <tr key={m.user_id}>
                      <td>{m.username}<div className="small muted">{m.email}</div></td><td>{m.role}</td>
                      <td style={{ textAlign: "right" }}>{t.role === "owner" && m.role !== "owner" && <ConfirmButton action={removeMemberAction.bind(null, t.id, m.user_id)} label="Remove" confirm={`Remove ${m.username}?`} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {t.role === "owner" && (
                <ActionForm action={addMemberAction.bind(null, t.id)} submit="Add person" pendingLabel="Adding..." resetOnSuccess>
                  <div className="cols">
                    <Field label="Email" name="email" type="email" required />
                    <div className="field">
                      <label htmlFor={`role-${t.id}`}>Can</label>
                      <select id={`role-${t.id}`} name="role" className="input" defaultValue="editor"><option value="editor">Edit shared links</option><option value="viewer">Only view</option></select>
                    </div>
                  </div>
                </ActionForm>
              )}
              {mine.length > 0 && (
                <details style={{ marginTop: 16 }}>
                  <summary className="small">Share your links with this workspace</summary>
                  <table className="table" style={{ marginTop: 8 }}>
                    <tbody>
                      {mine.map((l) => (
                        <tr key={l.id}><td className="slug"><b>/</b>{l.slug}</td><td style={{ textAlign: "right" }}><ShareLink linkId={l.id} teamId={t.id} shared={l.team_id === t.id} /></td></tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
