import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/brand";
import { listLinks } from "@/lib/services/links";
import { QrPanel } from "@/components/qr-panel";

export const metadata = { title: "QR codes" };

export default async function QrPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const user = await requireUser();
  const b = await getBrand();
  const { rows } = await listLinks({ userId: user.id, limit: 100, offset: 0 });
  const options = [{ slug: user.username, label: "Your bio page" }, ...rows.map((l) => ({ slug: l.slug, label: l.title || l.slug }))];
  const wanted = (await searchParams).s;
  const current = options.find((o) => o.slug === wanted) ?? options[0];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>QR codes</h1>
          <p>Every short link and your bio page has one. Pick what to print.</p>
        </div>
      </div>
      <div className="cols" style={{ gridTemplateColumns: "minmax(0, 4fr) minmax(0, 6fr)", alignItems: "start" }}>
        <nav aria-label="Choose a QR code">
          <table className="table">
            <tbody>
              {options.map((o) => (
                <tr key={o.slug}>
                  <td>
                    <Link href={`?s=${encodeURIComponent(o.slug)}`} aria-current={o.slug === current.slug ? "true" : undefined} style={{ fontWeight: o.slug === current.slug ? 700 : 400 }}>
                      {o.label}
                    </Link>
                    <div className="slug small muted">{b.host}<b>/</b>{o.slug}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="small muted" style={{ marginTop: 12 }}>Short links you create will show up here.</p> : null}
        </nav>
        <section>
          <div className="section-title"><h2>{current.label}</h2></div>
          <QrPanel key={current.slug} slug={current.slug} />
        </section>
      </div>
    </>
  );
}
