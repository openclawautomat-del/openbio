import Link from "next/link";
import { getBrand } from "@/lib/brand";

export async function AuthShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  const b = await getBrand();
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link href="/" className="brand">
          {b.logoUrl ? <img src={b.logoUrl} alt={b.name} /> : b.name}
        </Link>
        <div className="big">
          {b.tagline}
          <span className="slug">{b.host}<b>/</b>yourname</span>
        </div>
        <div className="small" style={{ opacity: 0.7 }}>{b.footerText || (b.supportEmail ? `Help: ${b.supportEmail}` : "")}</div>
      </aside>
      <main id="main" className="auth-form">
        <div>
          <h1>{title}</h1>
          {sub && <p className="sub">{sub}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}
