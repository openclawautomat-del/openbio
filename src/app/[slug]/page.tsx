import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBrand } from "@/lib/brand";
import { enforceHost } from "@/lib/host-guard";
import { reqInfo } from "@/lib/request";
import { recordClick } from "@/lib/analytics";
import { isBlocked } from "@/lib/validation";
import { getLinkBySlug, getPublicPage } from "@/lib/services/public";
import { linkState } from "@/lib/services/links";
import { PublicPageView } from "@/components/public-page";
import { ActionForm, Field } from "@/components/client";
import { unlockLinkAction } from "@/app/actions/public";
import "../bio.css";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await enforceHost();
  const { slug } = await params;
  const b = await getBrand();
  if (await getLinkBySlug(slug)) return { title: "Link", robots: { index: false, follow: false } }; // cached; no page query for redirects
  const data = await getPublicPage(slug);
  if (!data) return { title: "Link", robots: { index: false, follow: false } };
  const name = data.page.display_name || data.user.username;
  const desc = data.page.bio || b.tagline;
  return {
    title: name,
    description: desc,
    alternates: { canonical: `${b.url}/${data.user.username}` },
    openGraph: { title: name, description: desc, url: `${b.url}/${data.user.username}`, siteName: b.name, type: "profile", images: data.page.avatar_url ? [data.page.avatar_url] : undefined },
    twitter: { card: "summary", title: name, description: desc },
  };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SlugPage({ params, searchParams }: Props) {
  await enforceHost(); // before any lookup or click logging
  const { slug: raw } = await params;
  const slug = raw.toLowerCase();
  const sp = await searchParams;
  const b = await getBrand();

  const link = await getLinkBySlug(slug); // cached, so most redirects never reach MySQL
  const data = link ? null : await getPublicPage(slug);
  if (data) {
    const info = await reqInfo();
    await recordClick({
      type: "page", id: data.page.id, userId: data.user.id, info, ownHost: b.host,
      utm: { source: first(sp.utm_source), medium: first(sp.utm_medium), campaign: first(sp.utm_campaign) },
    });
    return <PublicPageView data={data} brand={b} />;
  }

  if (!link) notFound();

  const state = !link.owner_active ? "moderated" : linkState(link);
  if (state !== "active") return <Gone state={state} slug={slug} />;
  if (await isBlocked(link.target_url)) return <Gone state="moderated" slug={slug} />;
  // A link with an open abuse report is not followed automatically: the visitor sees where it goes and decides.
  if ((link.open_reports ?? 0) > 0 && sp.continue !== "1") return <Reported slug={slug} target={link.target_url} />;

  if (link.password_hash) {
    return (
      <main className="gone">
        <div className="gone-box">
          <p className="slug">{b.host}<b>/</b>{slug}</p>
          <h1>This link is protected</h1>
          <p>Enter the password the sender gave you to continue.</p>
          <ActionForm action={unlockLinkAction.bind(null, slug)} submit="Continue" pendingLabel="Checking...">
            <Field label="Password" name="password" type="password" autoComplete="off" required />
          </ActionForm>
        </div>
      </main>
    );
  }

  const info = await reqInfo();
  await recordClick({
    type: "link", id: link.id, userId: link.user_id, info, ownHost: b.host,
    utm: { source: first(sp.utm_source), medium: first(sp.utm_medium), campaign: first(sp.utm_campaign) },
  });
  redirect(link.target_url);
}

const COPY: Record<string, { title: string; body: string }> = {
  disabled: { title: "This link is switched off", body: "Its owner has paused it. Try again later or ask them directly." },
  expired: { title: "This link has expired", body: "It was set to stop working after a certain date. Ask the sender for a fresh one." },
  scheduled: { title: "This link is not live yet", body: "It has a start date that has not arrived. Check back soon." },
  moderated: { title: "This link was switched off", body: "An administrator disabled it, usually after a report. Do not follow it from another source either." },
  review: { title: "This link is waiting for review", body: "Its name needs a quick check by an administrator before it goes live." },
};

function Reported({ slug, target }: { slug: string; target: string }) {
  let shown = target;
  try { const u = new URL(target); shown = u.host + (u.pathname === "/" ? "" : u.pathname); } catch { /* keep raw */ }
  return (
    <main id="main" className="gone warn-page">
      <div className="gone-box">
        <p className="slug">/<b>{slug}</b></p>
        <h1>This link has been reported</h1>
        <p>Someone told us it may be spam, a scam or unsafe, and we have not checked it yet. It would take you to:</p>
        <p className="slug dest-url">{shown}</p>
        <p className="row wrap">
          <Link className="btn btn-primary" href="/">Take me back</Link>
          <a className="btn" href={`?continue=1`} rel="nofollow noreferrer">Continue anyway</a>
        </p>
        <p className="small"><Link href={`/report?target=${encodeURIComponent(slug)}`}>Report this link</Link></p>
      </div>
    </main>
  );
}

function Gone({ state, slug }: { state: string; slug: string }) {
  const c = COPY[state] ?? COPY.moderated;
  return (
    <main className="gone">
      <div className="gone-box">
        <p className="slug">/<b>{slug}</b></p>
        <h1>{c.title}</h1>
        <p>{c.body}</p>
        <p><Link href="/">Go to the home page</Link></p>
        <p className="small"><Link href={`/report?target=${encodeURIComponent(slug)}`}>Report this link</Link></p>
      </div>
    </main>
  );
}
