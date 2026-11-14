"use client";

import { useState } from "react";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** QR styling controls with live preview. PNG with a logo is drawn in the browser so no image library is needed on the server. */
export function QrPanel({ slug }: { slug: string }) {
  const [fg, setFg] = useState("#111111");
  const [bg, setBg] = useState("#ffffff");
  const [logo, setLogo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const qs = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ slug, fg: HEX.test(fg) ? fg : "#111111", bg: HEX.test(bg) ? bg : "#ffffff", src: "qr", ...extra });
    if (logo) p.set("logo", logo);
    return `/api/qr?${p}`;
  };

  async function upload(file: File) {
    setErr("");
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "Upload failed.");
    setLogo(j.url);
  }

  async function downloadPng() {
    setBusy(true);
    setErr("");
    try {
      if (!logo) {
        window.location.href = qs({ format: "png", size: "1024", download: "1" });
        return;
      }
      const svg = await (await fetch(qs({ size: "1024" }))).text();
      let inlined = svg;
      if (logo.startsWith("/uploads/")) {
        const blob = await (await fetch(logo)).blob();
        const data = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(blob); });
        inlined = svg.replace(/href="[^"]*"/, `href="${data}"`);
      }
      const img = new Image();
      const url = URL.createObjectURL(new Blob([inlined], { type: "image/svg+xml" }));
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("render")); img.src = url; });
      const c = document.createElement("canvas");
      c.width = c.height = 1024;
      c.getContext("2d")!.drawImage(img, 0, 0, 1024, 1024);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = `${slug}-qr.png`;
      a.click();
    } catch {
      setErr("Could not render the PNG with the logo. Download the SVG instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qr-panel">
      <img src={qs()} alt={`QR code for /${slug}`} width={220} height={220} style={{ border: "1px solid var(--line)", display: "block", background: bg }} />
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="field"><label htmlFor="qr-fg">Code colour</label><input id="qr-fg" className="input" type="color" value={fg} onChange={(e) => setFg(e.target.value)} /></div>
        <div className="field"><label htmlFor="qr-bg">Background</label><input id="qr-bg" className="input" type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></div>
      </div>
      <div className="field">
        <label htmlFor="qr-logo">Logo in the centre</label>
        <input id="qr-logo" className="input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <div className="hint">Square images work best. The code stays scannable because error correction is raised.</div>
        {logo && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setLogo("")}>Remove logo</button>}
      </div>
      {err && <div className="notice bad" role="alert">{err}</div>}
      <div className="row">
        <a className="btn btn-primary" href={qs({ download: "1" })}>Download SVG</a>
        <button className="btn" onClick={downloadPng} disabled={busy}>{busy ? "Preparing..." : "Download PNG"}</button>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>The code links to the address with ?utm_source=qr, so scans show up as their own source in analytics.</p>
    </div>
  );
}
