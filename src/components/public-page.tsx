import { CREDIT } from "@/lib/credit";
import type { CSSProperties } from "react";
import Link from "next/link";
import { resolveTheme, SOCIALS, type Socials } from "@/lib/themes";
import { embedInfo } from "@/lib/services/pages";
import type { PublicPage } from "@/lib/services/public";
import type { Brand } from "@/lib/brand";
import { ActionForm, Field } from "@/components/client";
import { contactAction } from "@/app/actions/public";
import { ArrowUpRight, Download, Mail } from "lucide-react";

const LABEL: Record<string, string> = {
  instagram: "Instagram", x: "X", youtube: "YouTube", tiktok: "TikTok", github: "GitHub", linkedin: "LinkedIn", facebook: "Facebook",
  twitch: "Twitch", mastodon: "Mastodon", bluesky: "Bluesky", spotify: "Spotify", email: "Email", website: "Website",
};

function socialHref(k: string, v: string): string {
  return k === "email" ? `mailto:${v}` : v;
}

export function PublicPageView({ data, brand }: { data: PublicPage; brand: Brand }) {
  const { page, user, blocks, groups } = data;
  const t = resolveTheme(page.theme, page.custom);
  const vars = {
    "--bg": t.bg, "--fg": t.fg, "--muted": t.muted, "--btn-bg": t.btnBg, "--btn-fg": t.btnFg, "--btn-border": t.btnBorder,
  } as CSSProperties;
  const socials = (page.socials ?? {}) as Socials;
  const name = page.display_name || user.username;

  // Group consecutive blocks by group_id so each group gets one heading.
  const rendered: React.ReactNode[] = [];
  let lastGroup: number | null | undefined;
  for (const b of blocks) {
    if (b.group_id && b.group_id !== lastGroup && groups[b.group_id]) {
      rendered.push(<h3 className="bio-group" key={`g${b.id}`}>{groups[b.group_id]}</h3>);
    }
    lastGroup = b.group_id;
    rendered.push(<BlockView key={b.id} b={b} />);
  }

  return (
    <main className={`bio bio-${t.font} bio-${t.shape} bio-${t.style}${t.pattern === "grid" ? " bio-grid" : ""}`} style={vars} data-theme-id={t.id}>
      <div className="bio-wrap">
        <header className="bio-head">
          {page.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bio-avatar" src={page.avatar_url} alt="" width={96} height={96} />
          ) : (
            <span className="bio-avatar bio-avatar-empty" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
          )}
          <h1>{name}</h1>
          <p className="bio-handle">{brand.host}<b>/</b>{user.username}</p>
          {page.bio ? <p className="bio-text">{page.bio}</p> : null}
        </header>

        <div className="bio-list">
          {rendered.length ? rendered : <p className="bio-empty">Nothing here yet.</p>}
        </div>

        {SOCIALS.some((k) => socials[k]) ? (
          <ul className="bio-socials" aria-label="Elsewhere">
            {SOCIALS.filter((k) => socials[k]).map((k) => (
              <li key={k}>
                <a href={socialHref(k, socials[k] as string)} rel="noopener noreferrer me" target={k === "email" ? undefined : "_blank"}>{LABEL[k]}</a>
              </li>
            ))}
          </ul>
        ) : null}

        <footer className="bio-foot">
          {brand.footerText ? <p>{brand.footerText}</p> : null}
          <p>
            <Link href={`/report?target=${encodeURIComponent(user.username)}`}>Report this page</Link>
            {brand.showCredit ? <> · <a href={CREDIT.url} rel="noopener">Powered by {CREDIT.name}</a></> : null}
          </p>
        </footer>
      </div>
    </main>
  );
}

function BlockView({ b }: { b: PublicPage["blocks"][number] }) {
  const d = b.data ?? {};
  switch (b.type) {
    case "header":
      return <h2 className="bio-header">{b.title}</h2>;
    case "link":
      return (
        <a className="bio-btn" href={`/out/${b.id}`} rel="nofollow noopener">
          <span>{b.title || b.url}</span>
          <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </a>
      );
    case "product":
      return (
        <a className="bio-product" href={`/out/${b.id}`} rel="nofollow noopener">
          <span className="bio-product-main">
            <strong>{b.title}</strong>
            {d.description ? <small>{d.description}</small> : null}
          </span>
          {d.price ? <span className="bio-price">{d.price}</span> : null}
          <span className="bio-product-cta">{d.button || "View"}</span>
        </a>
      );
    case "embed": {
      const e = b.url ? embedInfo(b.url) : null;
      if (!e) return null;
      return (
        <div className="bio-embed">
          {b.title ? <p className="bio-embed-title">{b.title}</p> : null}
          <iframe
            src={e.src} title={b.title || "Embedded content"} height={e.height} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow={e.kind === "map" ? "" : "encrypted-media; picture-in-picture; fullscreen"} allowFullScreen
          />
        </div>
      );
    }
    case "vcard":
      return (
        <a className="bio-btn" href={`/api/vcard/${b.id}`} download>
          <span>{b.title || "Save contact"}</span>
          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
        </a>
      );
    case "contact_form":
      return (
        <details className="bio-contact">
          <summary className="bio-btn"><span>{b.title || "Send a message"}</span><Mail size={16} strokeWidth={1.75} aria-hidden="true" /></summary>
          <ActionForm action={contactAction.bind(null, b.id)} submit="Send message" pendingLabel="Sending..." submitClass="bio-submit" resetOnSuccess>
            <Field label="Your name" name="name" maxLength={100} required />
            <Field label="Your email" name="email" type="email" required />
            <Field label="Message" name="message" textarea rows={4} maxLength={2000} required />
            <div className="bio-hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          </ActionForm>
        </details>
      );
    default:
      return null;
  }
}
