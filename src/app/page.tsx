import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import { isInstalled } from "@/lib/install";
import { flag } from "@/lib/settings";

export default async function Home() {
  if (!(await isInstalled())) redirect("/install");
  const b = await getBrand();
  const user = await currentUser();
  const open = await flag("registration_enabled", true);
  return (
    <div className="home">
      <header className="home-head">
        <Link href="/" className="brand" style={{ padding: 0 }}>{b.logoUrl ? <img src={b.logoUrl} alt={b.name} /> : b.name}</Link>
        <span style={{ flex: 1 }} />
        {user ? (
          <Link className="btn btn-primary" href="/dashboard">Open dashboard</Link>
        ) : (
          <>
            <Link className="btn btn-ghost" href="/login">Sign in</Link>
            {open ? <Link className="btn btn-primary" href="/register">Create account</Link> : null}
          </>
        )}
      </header>

      <section className="home-hero">
        <div>
          <h1>{b.tagline}</h1>
          <p className="lead">
            Shorten links, put everything you share on one page, print a QR code for either, and see which ones people actually open. It all runs on this server, and the visitor data stays here too.
          </p>
          {!user && open ? <Link className="btn btn-primary" href="/register">Claim your address</Link> : null}
        </div>
        <div className="ticket" aria-label="What an address looks like">
          <div><span className="slug">{b.host}<b>/</b>yourname</span></div>
          <div><span>Short link</span><span className="slug">{b.host}<b>/</b>spring-menu</span></div>
          <div><span>Points to</span><span className="slug">cafe.example/menus/spring.pdf</span></div>
          <div><span>QR code</span><span>PNG or SVG</span></div>
          <div><span>Opened</span><span>counted, never traced to a person</span></div>
        </div>
      </section>

      <div className="home-facts">
        <dl>
          <dt>Bio page</dt>
          <dd>Links, headings, socials and eight themes. Reorder by dragging. Schedule a link to appear on a date.</dd>
        </dl>
        <dl>
          <dt>Short links</dt>
          <dd>Pick your own slug, set an expiry, protect a link with a password, or switch it off without deleting it.</dd>
        </dl>
        <dl>
          <dt>Analytics</dt>
          <dd>Clicks, unique visitors, country, device, browser and referrer. IP addresses are hashed with a daily salt and never stored.</dd>
        </dl>
        <dl>
          <dt>API</dt>
          <dd>Create keys in the dashboard and manage links from your own scripts. <Link href="/docs">Read the reference</Link>.</dd>
        </dl>
      </div>

      <footer className="site-foot" style={{ marginTop: 64, padding: "24px 0" }}>
        <span>{b.footerText || b.name}</span>
        <nav aria-label="Legal">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/report">Report abuse</Link>
        </nav>
      </footer>
    </div>
  );
}
