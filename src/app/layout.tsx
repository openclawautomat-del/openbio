import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono, Fraunces } from "next/font/google";
import { getBrand } from "@/lib/brand";
import { enforceHost } from "@/lib/host-guard";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--f-display", display: "swap" });
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--f-text", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--f-mono", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], variable: "--f-serif", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return {
    metadataBase: new URL(b.url),
    title: { default: b.name, template: `%s | ${b.name}` },
    description: b.tagline,
    applicationName: b.name,
    openGraph: { siteName: b.name, title: b.name, description: b.tagline, type: "website", url: b.url },
    twitter: { card: "summary", title: b.name, description: b.tagline },
    icons: b.faviconUrl ? { icon: b.faviconUrl } : { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await enforceHost(); // unknown hosts, and public content on a non-default host, are a plain 404
  const b = await getBrand();
  const theme = (await cookies()).get("theme")?.value;
  return (
    <html
      lang="en"
      data-theme={theme === "dark" || theme === "light" ? theme : undefined}
      data-fonts={b.fontPair}
      className={`${display.variable} ${text.variable} ${mono.variable} ${serif.variable}`}
      style={{ "--accent": b.primary } as React.CSSProperties}
    >
      <body>
        <a href="#main" className="skip">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
