export type ButtonShape = "square" | "round" | "pill";
export type ButtonStyle = "solid" | "outline" | "offset";
export type PageFont = "sans" | "serif" | "mono";

export interface Theme {
  id: string;
  name: string;
  note: string;
  bg: string;
  fg: string;
  muted: string;
  btnBg: string;
  btnFg: string;
  btnBorder: string;
  shape: ButtonShape;
  style: ButtonStyle;
  font: PageFont;
  pattern?: "grid" | "dots" | "none";
}

export const THEMES: Theme[] = [
  { id: "paper", name: "Paper", note: "Quiet ink on cool paper.", bg: "#F2F3F0", fg: "#15191C", muted: "#5B6670", btnBg: "#FFFFFF", btnFg: "#15191C", btnBorder: "#15191C", shape: "square", style: "offset", font: "sans" },
  { id: "ledger", name: "Ledger", note: "Monospace on dark, like a terminal log.", bg: "#0F1411", fg: "#D8E4DA", muted: "#7E9183", btnBg: "transparent", btnFg: "#D8E4DA", btnBorder: "#3A4A40", shape: "square", style: "outline", font: "mono" },
  { id: "riso", name: "Riso", note: "Two-ink print, pink stock and blue.", bg: "#F7D3DE", fg: "#1B2BA8", muted: "#4A57C2", btnBg: "#1B2BA8", btnFg: "#F7D3DE", btnBorder: "#1B2BA8", shape: "round", style: "solid", font: "serif" },
  { id: "slate", name: "Slate", note: "Hairlines on deep slate.", bg: "#1B2127", fg: "#E8ECEF", muted: "#98A4AD", btnBg: "#242C33", btnFg: "#E8ECEF", btnBorder: "#38434C", shape: "round", style: "solid", font: "sans" },
  { id: "meadow", name: "Meadow", note: "Deep green with soft pill buttons.", bg: "#1F3D2B", fg: "#EAF2E3", muted: "#A9C2AE", btnBg: "#EAF2E3", btnFg: "#1F3D2B", btnBorder: "#EAF2E3", shape: "pill", style: "solid", font: "serif" },
  { id: "sunday", name: "Sunday", note: "Loud yellow, thick black lines.", bg: "#F4D03F", fg: "#111111", muted: "#3B3B3B", btnBg: "#FFFFFF", btnFg: "#111111", btnBorder: "#111111", shape: "square", style: "offset", font: "sans" },
  { id: "plain", name: "Plain", note: "White page, black type, nothing extra.", bg: "#FFFFFF", fg: "#111111", muted: "#6B6B6B", btnBg: "transparent", btnFg: "#111111", btnBorder: "#111111", shape: "square", style: "outline", font: "serif" },
  { id: "blueprint", name: "Blueprint", note: "Technical drawing, white line on blue.", bg: "#0B3D91", fg: "#F1F6FF", muted: "#A9C1EE", btnBg: "transparent", btnFg: "#F1F6FF", btnBorder: "#F1F6FF", shape: "square", style: "outline", font: "mono", pattern: "grid" },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export interface PageCustom {
  bg?: string;
  fg?: string;
  btnBg?: string;
  btnFg?: string;
  shape?: ButtonShape;
  style?: ButtonStyle;
  font?: PageFont;
}

export function resolveTheme(id: string, custom: PageCustom | null | undefined): Theme {
  const t = themeById(id);
  const c = custom ?? {};
  const hex = (v?: string) => (v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined);
  return {
    ...t,
    bg: hex(c.bg) ?? t.bg,
    fg: hex(c.fg) ?? t.fg,
    btnBg: hex(c.btnBg) ?? t.btnBg,
    btnFg: hex(c.btnFg) ?? t.btnFg,
    btnBorder: hex(c.btnFg) && !hex(c.btnBg) ? (hex(c.btnFg) as string) : t.btnBorder,
    shape: c.shape ?? t.shape,
    style: c.style ?? t.style,
    font: c.font ?? t.font,
  };
}

export const SOCIALS = [
  "instagram", "x", "youtube", "tiktok", "github", "linkedin", "facebook", "twitch", "mastodon", "bluesky", "spotify", "email", "website",
] as const;
export type SocialKey = (typeof SOCIALS)[number];
export type Socials = Partial<Record<SocialKey, string>>;
