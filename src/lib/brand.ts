import { getSettings } from "./settings";

export interface Brand {
  name: string;
  tagline: string;
  url: string;
  host: string;
  supportEmail: string;
  primary: string;
  logoUrl: string;
  faviconUrl: string;
  fontPair: "grotesk" | "serif";
  footerText: string;
  showCredit: boolean;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Priority: admin DB setting > env var > default. No product name lives anywhere else in the codebase. */
export async function getBrand(): Promise<Brand> {
  const s = await getSettings();
  const url = (s.brand_url || process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const primary = s.brand_primary || process.env.APP_PRIMARY_COLOR || "#0E7C66";
  let host = "localhost";
  try {
    host = new URL(url).host;
  } catch {}
  const name = s.brand_name || process.env.APP_NAME || "Open Bio";
  return {
    name,
    tagline: s.brand_tagline || process.env.APP_TAGLINE || "Your links, one page, your server.",
    url,
    host,
    supportEmail: s.brand_support_email || process.env.APP_SUPPORT_EMAIL || "",
    primary: HEX.test(primary) ? primary : "#0E7C66",
    logoUrl: s.brand_logo_url || "",
    faviconUrl: s.brand_favicon_url || "",
    fontPair: s.brand_font === "serif" ? "serif" : "grotesk",
    footerText: s.brand_footer_text || "",
    showCredit: s.brand_powered_by === "1",
  };
}

/** Short link base, e.g. https://example.com/ */
export function shortUrl(brand: Pick<Brand, "url">, slug: string): string {
  return `${brand.url}/${slug}`;
}
