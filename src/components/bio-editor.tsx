"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { ActionForm, Field } from "./client";
import { deleteBlockAction, reorderBlocksAction, saveBlockAction, toggleBlockAction } from "@/app/actions/app";
import type { Theme } from "@/lib/themes";

export function AvatarField({ defaultValue, name }: { defaultValue: string; name: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function upload(f: File) {
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Upload failed.");
    setUrl(j.url);
  }
  return (
    <div className="field">
      <label htmlFor="avatar-file">Photo</label>
      <div className="row">
        {url ? <img src={url} alt="" width={56} height={56} style={{ objectFit: "cover", border: "1px solid var(--line)" }} /> : <div className="avatar-empty" aria-hidden="true" />}
        <input id="avatar-file" className="input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        {url && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setUrl("")}>Remove</button>}
      </div>
      <input type="hidden" name={name} value={url} />
      <div className="hint">{busy ? "Uploading..." : "PNG, JPEG, GIF or WebP, up to 2 MB."}</div>
      {err && <div className="err" role="alert">{err}</div>}
    </div>
  );
}

export function ThemePicker({ themes, current, custom }: { themes: Theme[]; current: string; custom: Record<string, string> }) {
  const [sel, setSel] = useState(current);
  const [on, setOn] = useState(!!(custom.bg || custom.fg || custom.btnBg || custom.btnFg));
  const base = themes.find((t) => t.id === sel) ?? themes[0];
  const val = (k: "bg" | "fg" | "btnBg" | "btnFg") => custom[k] ?? (/^#[0-9a-f]{6}$/i.test(base[k]) ? base[k] : "#ffffff");
  return (
    <>
      <fieldset className="themes">
        <legend className="sr-only">Theme</legend>
        {themes.map((t) => (
          <label key={t.id} className={`theme-opt ${sel === t.id ? "on" : ""}`}>
            <input type="radio" name="theme" value={t.id} checked={sel === t.id} onChange={() => setSel(t.id)} />
            <span className="theme-swatch" style={{ background: t.bg, color: t.fg, fontFamily: t.font === "mono" ? "var(--font-mono)" : t.font === "serif" ? "var(--font-display)" : "var(--font-text)" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Aa</span>
              <span className="theme-btn" style={{ background: t.btnBg, color: t.btnFg, borderColor: t.btnBorder, borderRadius: t.shape === "pill" ? 99 : t.shape === "round" ? 6 : 0 }} />
            </span>
            <span className="theme-name">{t.name}</span>
            <span className="small muted">{t.note}</span>
          </label>
        ))}
      </fieldset>
      <label className="check"><input type="checkbox" name="use_custom" checked={on} onChange={(e) => setOn(e.target.checked)} /> Use my own colours</label>
      {on && (
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="field"><label htmlFor="c-bg">Background</label><input id="c-bg" className="input" type="color" name="bg" defaultValue={val("bg")} /></div>
          <div className="field"><label htmlFor="c-fg">Text</label><input id="c-fg" className="input" type="color" name="fg" defaultValue={val("fg")} /></div>
          <div className="field"><label htmlFor="c-bb">Button</label><input id="c-bb" className="input" type="color" name="btnBg" defaultValue={val("btnBg")} /></div>
          <div className="field"><label htmlFor="c-bf">Button text</label><input id="c-bf" className="input" type="color" name="btnFg" defaultValue={val("btnFg")} /></div>
        </div>
      )}
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="field"><label htmlFor="c-shape">Button shape</label>
          <select id="c-shape" className="input" name="shape" defaultValue={custom.shape ?? "default"}><option value="default">Theme default</option><option value="square">Square</option><option value="round">Slightly round</option><option value="pill">Pill</option></select></div>
        <div className="field"><label htmlFor="c-style">Button style</label>
          <select id="c-style" className="input" name="style" defaultValue={custom.style ?? "default"}><option value="default">Theme default</option><option value="solid">Solid</option><option value="outline">Outline</option><option value="offset">Offset shadow</option></select></div>
        <div className="field"><label htmlFor="c-font">Typeface</label>
          <select id="c-font" className="input" name="font" defaultValue={custom.font ?? "default"}><option value="default">Theme default</option><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select></div>
      </div>
    </>
  );
}

export interface BlockItem {
  id: number; type: string; title: string; url: string; enabled: boolean;
  data: Record<string, string>; group_id: number | null; starts_at: string; ends_at: string; clicks: number;
}
const TYPE_LABEL: Record<string, string> = { link: "Link", header: "Heading", contact_form: "Contact form", product: "Product", embed: "Embed", vcard: "Contact card" };

export function BlockFields({ type, b, groups }: { type: string; b?: BlockItem; groups: { id: number; name: string }[] }) {
  const d = b?.data ?? {};
  return (
    <>
      <input type="hidden" name="type" value={type} />
      {type !== "vcard" && <Field label={type === "header" ? "Heading" : "Title"} name="title" defaultValue={b?.title} maxLength={120} required={type !== "embed"} />}
      {(type === "link" || type === "product" || type === "embed") && (
        <Field label={type === "embed" ? "Video, track or map address" : type === "product" ? "Buy / details address" : "Address"} name="url" type="url" defaultValue={b?.url} required hint={type === "embed" ? "YouTube, Spotify or Google Maps." : undefined} />
      )}
      {type === "product" && (
        <div className="grid2">
          <Field label="Price" name="price" defaultValue={d.price} maxLength={40} hint="Shown as typed, e.g. $24 or from $90." />
          <Field label="Button text" name="button" defaultValue={d.button} maxLength={30} placeholder="Buy now" />
        </div>
      )}
      {(type === "product" || type === "contact_form") && <Field label="Description" name="description" textarea rows={3} defaultValue={d.description} maxLength={300} />}
      {type === "contact_form" && <Field label="Button text" name="button" defaultValue={d.button} maxLength={30} placeholder="Send message" />}
      {type === "vcard" && (
        <>
          <Field label="Name on the card" name="title" defaultValue={b?.title} maxLength={120} required />
          <div className="grid2">
            <Field label="Email" name="email" type="email" defaultValue={d.email} />
            <Field label="Phone" name="phone" defaultValue={d.phone} maxLength={40} />
          </div>
          <Field label="Organisation" name="org" defaultValue={d.org} maxLength={120} />
          <Field label="Website" name="url" type="url" defaultValue={b?.url} />
        </>
      )}
      {type !== "header" && (
        <div className="grid2">
          <Field label="Show from (UTC)" name="starts_at" type="datetime-local" defaultValue={b?.starts_at} hint="Optional. Schedule a block." />
          <Field label="Hide after (UTC)" name="ends_at" type="datetime-local" defaultValue={b?.ends_at} />
        </div>
      )}
      {groups.length > 0 && type !== "header" && (
        <div className="field"><label htmlFor={`g-${b?.id ?? "new"}`}>Group</label>
          <select id={`g-${b?.id ?? "new"}`} className="input" name="group_id" defaultValue={b?.group_id ?? ""}><option value="">No group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
      )}
    </>
  );
}

export function NewBlock({ types, groups }: { types: string[]; groups: { id: number; name: string }[] }) {
  const [type, setType] = useState(types[0]);
  return (
    <div>
      <div className="row" role="tablist" aria-label="Block type" style={{ marginBottom: 16 }}>
        {types.map((t) => <button key={t} type="button" role="tab" aria-selected={type === t} className={`btn btn-sm ${type === t ? "btn-primary" : ""}`} onClick={() => setType(t)}>{TYPE_LABEL[t]}</button>)}
      </div>
      <ActionForm key={type} action={saveBlockAction.bind(null, null)} submit={`Add ${TYPE_LABEL[type].toLowerCase()}`} pendingLabel="Adding..." resetOnSuccess>
        <BlockFields type={type} groups={groups} />
      </ActionForm>
    </div>
  );
}

export function BlockList({ blocks, groups }: { blocks: BlockItem[]; groups: { id: number; name: string }[] }) {
  const [order, setOrder] = useState(blocks);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [, start] = useTransition();
  function drop(target: number) {
    if (drag === null || drag === target) return;
    const next = order.filter((b) => b.id !== drag);
    const idx = next.findIndex((b) => b.id === target);
    next.splice(idx, 0, order.find((b) => b.id === drag)!);
    setOrder(next);
    start(async () => { await reorderBlocksAction(next.map((b) => b.id)); });
  }
  function move(id: number, dir: -1 | 1) {
    const i = order.findIndex((b) => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    start(async () => { await reorderBlocksAction(next.map((b) => b.id)); });
  }
  if (order.length === 0) return <div className="empty"><h3>Nothing on your page yet</h3><p>Add a link below. Drag to reorder once you have a few.</p></div>;
  return (
    <ul className="block-list">
      {order.map((b) => (
        <li key={b.id} className={`${drag === b.id ? "dragging" : ""} ${over === b.id && drag !== b.id ? "drop-before" : ""}`} draggable onDragStart={() => setDrag(b.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onDragOver={(e) => { e.preventDefault(); setOver(b.id); }} onDrop={(e) => { e.preventDefault(); drop(b.id); setOver(null); }}>
          <div className="block-row">
            <span className="drag-handle" aria-hidden="true"><GripVertical className="icon" /></span>
            <div className="block-main">
              <span className="title">{b.type === "vcard" ? "Contact card" : b.title || TYPE_LABEL[b.type]}</span>
              <span className="small muted">{TYPE_LABEL[b.type]}{b.url ? ` - ${b.url}` : ""}</span>
            </div>
            <span className="small muted num" title="Clicks">{b.clicks.toLocaleString("en-US")}</span>
            <span className="move">
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Move ${b.title || "block"} up`} onClick={() => move(b.id, -1)}><ArrowUp className="icon" /></button>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Move ${b.title || "block"} down`} onClick={() => move(b.id, 1)}><ArrowDown className="icon" /></button>
            </span>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={b.enabled ? "Hide block" : "Show block"} title={b.enabled ? "Visible. Click to hide" : "Hidden. Click to show"} onClick={() => start(async () => { await toggleBlockAction(b.id); setOrder((o) => o.map((x) => (x.id === b.id ? { ...x, enabled: !x.enabled } : x))); })}>
              {b.enabled ? <Eye className="icon" /> : <EyeOff className="icon" />}
            </button>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Delete block" onClick={() => { if (window.confirm("Delete this block?")) start(async () => { await deleteBlockAction(b.id); setOrder((o) => o.filter((x) => x.id !== b.id)); }); }}><Trash2 className="icon" /></button>
          </div>
          <details className="edit">
            <summary className="small">Edit</summary>
            <ActionForm action={saveBlockAction.bind(null, b.id)} submit="Save block" pendingLabel="Saving...">
              <BlockFields type={b.type} b={b} groups={groups} />
            </ActionForm>
          </details>
        </li>
      ))}
    </ul>
  );
}
