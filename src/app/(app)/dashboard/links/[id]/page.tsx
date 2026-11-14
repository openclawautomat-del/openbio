import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBrand, shortUrl } from "@/lib/brand";
import { getLinkForUser, linkState } from "@/lib/services/links";
import { getStats, countryName } from "@/lib/analytics";
import { ActionForm, Field, CopyButton } from "@/components/client";
import { BarList, StatRow, TimeSeries } from "@/components/charts";
import { QrPanel } from "@/components/qr-panel";
import { updateLinkAction } from "@/app/actions/app";

export const metadata = { title: "Link" };
const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 16) : "");

export default async function LinkDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const link = await getLinkForUser(user.id, Number(id), user.role === "super_admin");
  if (!link) notFound();
  const dq = Number((await searchParams).days);
  const days = [7, 30, 90].includes(dq) ? dq : 30;
  const b = await getBrand();
  const stats = await getStats({ entityType: "link", entityId: link.id, days });
  const short = shortUrl(b, link.slug);
  return (
    <>
      <div className="page-head">
        <div>
          <p><Link href="/dashboard/links">Links</Link> /</p>
          <h1>{link.title || link.slug}</h1>
          <div className="row"><span className="slug">{b.host}<b>/</b>{link.slug}</span><CopyButton value={short} /><span className="badge">{linkState(link)}</span></div>
        </div>
        <div className="row small">
          {[7, 30, 90].map((d) => <Link key={d} className={`btn btn-sm ${d === days ? "btn-primary" : ""}`} href={`?days=${d}`}>{d} days</Link>)}
        </div>
      </div>
      <StatRow items={[{ label: "Clicks", value: stats.total }, { label: "Unique visitors", value: stats.unique }, { label: "Countries", value: stats.countries.filter((c) => c.label !== "Unknown").length }, { label: "Top referrer", value: stats.referrers[0]?.label ?? "None yet" }]} />
      <TimeSeries series={stats.series} label={`Clicks per day, last ${days} days`} />
      <div className="cols" style={{ marginTop: 40 }}>
        <BarList title="Countries" rows={stats.countries.map((c) => ({ ...c, label: countryName(c.label) }))} />
        <BarList title="Referrers" rows={stats.referrers} />
        <BarList title="Devices" rows={stats.devices} />
        <BarList title="Browsers" rows={stats.browsers} />
        {stats.campaigns.some((c) => c.label !== "No campaign") && <BarList title="Campaigns (utm_campaign)" rows={stats.campaigns} />}
      </div>

      <div className="cols" style={{ marginTop: 48, alignItems: "start" }}>
        <section>
          <div className="section-title"><h2>Settings</h2></div>
          <ActionForm action={updateLinkAction.bind(null, link.id)} submit="Save changes" pendingLabel="Saving...">
            <Field label="Destination URL" name="target_url" type="url" defaultValue={link.target_url} required />
            <Field label="Short name" name="slug" prefix={`${b.host}/`} defaultValue={link.slug} maxLength={64} required />
            <Field label="Label" name="title" defaultValue={link.title} maxLength={160} />
            <div className="grid2">
              <Field label="Starts (UTC)" name="starts_at" type="datetime-local" defaultValue={iso(link.starts_at)} />
              <Field label="Expires (UTC)" name="expires_at" type="datetime-local" defaultValue={iso(link.expires_at)} />
            </div>
            <Field label={link.password_hash ? "New password" : "Password"} name="password" autoComplete="off" hint={link.password_hash ? "Leave empty to keep the current password." : "Optional."} />
            {link.password_hash && <label className="check"><input type="checkbox" name="remove_password" /> Remove password protection</label>}
            <label className="check"><input type="checkbox" name="enabled" defaultChecked={!!link.enabled} /> Link is enabled</label>
          </ActionForm>
        </section>
        <section>
          <div className="section-title"><h2>QR code</h2></div>
          <QrPanel slug={link.slug} />
        </section>
      </div>
    </>
  );
}
