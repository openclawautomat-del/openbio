import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { ensurePage, getBlocks, BLOCK_TYPES_P1, BLOCK_TYPES_P2 } from "@/lib/services/pages";
import { totalsFor } from "@/lib/analytics";
import { SOCIALS, THEMES } from "@/lib/themes";
import { phase2Enabled } from "@/lib/features";
import { ActionForm, Field, CopyButton } from "@/components/client";
import { AvatarField, BlockList, NewBlock, ThemePicker, type BlockItem } from "@/components/bio-editor";
import { saveProfileAction, saveSocialsAction, saveThemeAction } from "@/app/actions/app";

export const metadata = { title: "Bio page" };
const local = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 16) : "");

export default async function BioEditor() {
  const user = await requireUser();
  const b = await getBrand();
  const page = await ensurePage(user.id, user.username);
  const blocks = await getBlocks(page.id);
  const totals = await totalsFor("block", blocks.map((x) => x.id));
  const p2 = phase2Enabled();
  const groups = p2 ? await query<{ id: number; name: string }>("SELECT id, name FROM link_groups WHERE user_id = ? ORDER BY name", [user.id]).catch(() => []) : [];
  const items: BlockItem[] = blocks.map((x) => ({
    id: x.id, type: x.type, title: x.title ?? "", url: x.url ?? "", enabled: !!x.enabled, data: x.data ?? {}, group_id: x.group_id,
    starts_at: local(x.starts_at), ends_at: local(x.ends_at), clicks: totals[x.id]?.total ?? 0,
  }));
  const types = [...BLOCK_TYPES_P1, ...(p2 ? BLOCK_TYPES_P2 : [])] as string[];
  const address = `${b.url}/${user.username}`;
  return (
    <>
      <div className="page-head">
        <div><h1>Bio page</h1><p>One address for everything you share.</p></div>
        <div className="row">
          <span className="slug">{b.host}<b>/</b>{user.username}</span>
          <CopyButton value={address} label="Copy page address" />
          <Link className="btn" href={`/${user.username}`} target="_blank">View page</Link>
        </div>
      </div>
      {page.moderated ? <div className="notice bad" role="alert">An administrator has taken this page offline. Contact {b.supportEmail} if you think this is a mistake.</div> : null}

      <div className="cols editor" style={{ alignItems: "start" }}>
        <div>
          <section>
            <div className="section-title"><h2>Content</h2></div>
            <BlockList key={items.map((i) => `${i.id}:${i.title}:${i.url}`).join("|")} blocks={items} groups={groups} />
            <details className="edit panel" open={items.length === 0}>
              <summary className="btn btn-primary" style={{ display: "inline-flex" }}>Add to page</summary>
              <NewBlock types={types} groups={groups} />
            </details>
          </section>
        </div>

        <div>
          <section>
            <div className="section-title"><h2>Profile</h2></div>
            <ActionForm action={saveProfileAction} submit="Save profile" pendingLabel="Saving...">
              <AvatarField name="avatar_url" defaultValue={page.avatar_url ?? ""} />
              <Field label="Display name" name="display_name" defaultValue={page.display_name} maxLength={80} />
              <Field label="Bio" name="bio" textarea rows={3} defaultValue={page.bio} maxLength={500} hint="Up to 500 characters." />
              <label className="check"><input type="checkbox" name="published" defaultChecked={!!page.published} /> Page is public</label>
            </ActionForm>
          </section>

          <section style={{ marginTop: 40 }}>
            <div className="section-title"><h2>Appearance</h2></div>
            <ActionForm action={saveThemeAction} submit="Save appearance" pendingLabel="Saving...">
              <ThemePicker themes={THEMES} current={page.theme} custom={(page.custom ?? {}) as Record<string, string>} />
            </ActionForm>
          </section>

          <section style={{ marginTop: 40 }}>
            <div className="section-title"><h2>Social icons</h2></div>
            <ActionForm action={saveSocialsAction} submit="Save social links" pendingLabel="Saving...">
              <div className="grid2">
                {SOCIALS.map((k) => (
                  <Field key={k} label={k === "x" ? "X" : k === "email" ? "Email" : k[0].toUpperCase() + k.slice(1)} name={`social_${k}`} type={k === "email" ? "email" : "text"} defaultValue={page.socials?.[k] ?? ""} placeholder={k === "email" ? "you@example.com" : "https://"} />
                ))}
              </div>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}
