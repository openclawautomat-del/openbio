import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBrand } from "@/lib/brand";
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
  const { slug } = await params;
  const b = await getBrand();
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
  const { slug: raw } = await params;
  const slug = raw.toLowerCase();
  const sp = await searchParams;
  const b = await getBrand();

  const data = await getPublicPage(slug);
  if (data) {
    const info = await reqInfo();
    await recordClick({
      type: "page", id: data.page.id, userId: data.user.id, info, ownHost: b.host,
      utm: { source: first(sp.utm_source), medium: first(sp.utm_medium), campaign: first(sp.utm_campaign) },
    });
    return <PublicPageView data={data} brand={b} />;
  }

  const link = await getLinkBySlug(slug);
  if (!link) notFound();

  const state = !link.owner_active ? "moderated" : linkState(link);
  if (state !== "active") return <Gone state={state} slug={slug} />;
  if (await isBlocked(link.target_url)) return <Gone state="moderated" slug={slug} />;

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
  moderated: { title: "This link is unavailable", body: "It was removed by an administrator of this server." },
};

function Gone({ state, slug }: { state: string; slug: string }) {
  const c = COPY[state] ?? COPY.moderated;
  return (
    <main className="gone">
      <div className="gone-box">
        <p className="slug">/<b>{slug}</b></p>
        <h1>{c.title}</h1>
        <p>{c.body}</p>
        <p><Link href="/">Go to the home page</Link></p>
      </div>
    </main>
  );
}
