import QRCode from "qrcode";

export interface QrOptions {
  fg?: string;
  bg?: string;
  size?: number;
  margin?: number;
  /** https or /uploads URL drawn in the centre of the code (SVG only). */
  logo?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const clean = (c: string | undefined, d: string) => (c && HEX.test(c) ? c : d);

/** Builds an SVG QR code from the module matrix. Error correction is raised to H when a logo hides the centre. */
export function qrSvg(text: string, o: QrOptions = {}): string {
  const fg = clean(o.fg, "#000000");
  const bg = clean(o.bg, "#FFFFFF");
  const margin = Math.max(0, Math.min(8, o.margin ?? 2));
  const qr = QRCode.create(text, { errorCorrectionLevel: o.logo ? "H" : "M" });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const dim = n + margin * 2;
  let d = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (data[y * n + x]) {
        let run = 1;
        while (x + run < n && data[y * n + x + run]) run++;
        d += `M${x + margin} ${y + margin}h${run}v1h-${run}z`;
        x += run;
      } else x++;
    }
  }
  let logo = "";
  if (o.logo) {
    const s = Math.round(n * 0.22);
    const pos = (dim - s) / 2;
    const href = o.logo.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    logo = `<rect x="${pos - 0.6}" y="${pos - 0.6}" width="${s + 1.2}" height="${s + 1.2}" fill="${bg}"/><image href="${href}" x="${pos}" y="${pos}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const px = Math.max(64, Math.min(2048, o.size ?? 512));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="${bg}"/><path d="${d}" fill="${fg}"/>${logo}</svg>`;
}

export async function qrPng(text: string, o: QrOptions = {}): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    width: Math.max(64, Math.min(2048, o.size ?? 512)),
    margin: Math.max(0, Math.min(8, o.margin ?? 2)),
    errorCorrectionLevel: "M",
    color: { dark: clean(o.fg, "#000000"), light: clean(o.bg, "#FFFFFF") },
  });
}
