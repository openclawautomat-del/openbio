import type { Brand } from "../brand";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface EmailContent {
  subject: string;
  preheader?: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  footnote?: string;
}

/** Responsive, table-based HTML plus a plain-text twin. All branding comes from the Brand object. */
export function renderEmail(brand: Brand, c: EmailContent): { html: string; text: string } {
  const accent = brand.primary;
  const logo = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl.startsWith("/") ? brand.url + brand.logoUrl : brand.logoUrl)}" alt="${esc(brand.name)}" height="28" style="display:block;height:28px;border:0">`
    : `<span style="font:700 18px/1 Helvetica,Arial,sans-serif;letter-spacing:-0.02em;color:#15191C">${esc(brand.name)}</span>`;
  const paras = c.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font:400 16px/1.6 Helvetica,Arial,sans-serif;color:#2A3035">${esc(p)}</p>`)
    .join("");
  const btn = c.button
    ? `<p style="margin:24px 0"><a href="${esc(c.button.url)}" style="display:inline-block;padding:12px 20px;background:${accent};color:#ffffff;text-decoration:none;font:600 15px/1 Helvetica,Arial,sans-serif;border-radius:6px">${esc(c.button.label)}</a></p>
       <p style="margin:0 0 16px;font:400 13px/1.5 Helvetica,Arial,sans-serif;color:#5B6670">If the button does not work, paste this link into your browser:<br><a href="${esc(c.button.url)}" style="color:${accent};word-break:break-all">${esc(c.button.url)}</a></p>`
    : "";
  const foot = [c.footnote, brand.footerText, brand.supportEmail ? `Questions? ${brand.supportEmail}` : ""].filter(Boolean).join(" | ");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#F2F3F0">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader ?? c.heading)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F2F3F0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px">
<tr><td style="padding:0 0 20px">${logo}</td></tr>
<tr><td style="background:#ffffff;border:1px solid #D9DDD8;border-radius:8px;padding:32px 28px">
<h1 style="margin:0 0 16px;font:700 22px/1.25 Helvetica,Arial,sans-serif;letter-spacing:-0.02em;color:#15191C">${esc(c.heading)}</h1>
${paras}${btn}
</td></tr>
<tr><td style="padding:16px 4px;font:400 12px/1.5 Helvetica,Arial,sans-serif;color:#5B6670">${esc(foot)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [c.heading, "", ...c.paragraphs, ...(c.button ? ["", `${c.button.label}: ${c.button.url}`] : []), "", "--", foot].join("\n");
  return { html, text };
}
