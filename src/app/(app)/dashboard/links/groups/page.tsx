import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { phase2Enabled } from "@/lib/features";
import { ActionForm, ConfirmButton, Field } from "@/components/client";
import { GroupPicker } from "@/components/group-picker";
import { createGroupAction, deleteGroupAction } from "@/app/actions/phase2";

export const metadata = { title: "Link groups" };
export const dynamic = "force-dynamic";

export default async function Groups() {
  if (!phase2Enabled()) notFound();
  const u = await requireUser();
  const groups = await query<{ id: number; name: string; n: number }>(
    "SELECT g.id, g.name, (SELECT COUNT(*) FROM links l WHERE l.group_id = g.id) AS n FROM link_groups g WHERE g.user_id = ? ORDER BY g.name", [u.id],
  );
  const links = await query<{ id: number; slug: string; title: string | null; group_id: number | null }>(
    "SELECT id, slug, title, group_id FROM links WHERE user_id = ? ORDER BY id DESC LIMIT 200", [u.id],
  );
  return (
    <>
      <div className="page-head"><div><h1>Link groups</h1><p>Folders for your links, for example one per campaign. <Link href="/dashboard/links">Back to links</Link></p></div></div>
      <div className="cols">
        <section>
          <ActionForm action={createGroupAction} submit="Create group" pendingLabel="Creating..." resetOnSuccess>
            <Field label="Group name" name="name" placeholder="Spring launch" maxLength={80} required />
          </ActionForm>
          {groups.length > 0 && (
            <table className="table" style={{ marginTop: 24 }}>
              <thead><tr><th>Group</th><th>Links</th><th /></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td><td className="num">{Number(g.n)}</td>
                    <td style={{ textAlign: "right" }}><ConfirmButton action={deleteGroupAction.bind(null, g.id)} label="Delete" confirm={`Delete the group ${g.name}? Its links are kept.`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section>
          {links.length === 0 ? (
            <div className="empty"><h3>No links to sort</h3><p>Create a short link first, then file it here.</p></div>
          ) : groups.length === 0 ? (
            <div className="empty"><h3>Create a group first</h3><p>Then pick a group for each link from this list.</p></div>
          ) : (
            <table className="table">
              <thead><tr><th>Link</th><th>Group</th></tr></thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id}>
                    <td><span className="slug"><b>/</b>{l.slug}</span>{l.title && <div className="small muted">{l.title}</div>}</td>
                    <td><GroupPicker linkId={l.id} value={l.group_id} groups={groups.map((g) => ({ id: g.id, name: g.name }))} /></td>
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
