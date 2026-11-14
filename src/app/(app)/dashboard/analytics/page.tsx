import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getStats, countryName } from "@/lib/analytics";
import { phase2Enabled } from "@/lib/features";
import { BarList, StatRow, TimeSeries } from "@/components/charts";

export const metadata = { title: "Analytics" };

export default async function Analytics({ searchParams }: { searchParams: Promise<{ days?: string; view?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const days = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const kind = sp.view === "views" ? "views" : "clicks";
  const stats = await getStats({ userId: user.id, kind, days });
  const href = (o: { days?: number; view?: string }) => `?days=${o.days ?? days}&view=${o.view ?? kind}`;
  const empty = stats.total === 0;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p>{kind === "clicks" ? "Clicks on your short links and bio page buttons." : "Visits to your bio page."}</p>
        </div>
        <div className="row small">
          {phase2Enabled() ? <a className="btn btn-sm" href={`/api/export/stats?days=${days}&view=${kind}`}>Export CSV</a> : null}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="row">
          <Link className={`btn btn-sm ${kind === "clicks" ? "btn-primary" : ""}`} href={href({ view: "clicks" })}>Clicks</Link>
          <Link className={`btn btn-sm ${kind === "views" ? "btn-primary" : ""}`} href={href({ view: "views" })}>Page views</Link>
        </div>
        <div className="row">
          {[7, 30, 90, 365].map((d) => (
            <Link key={d} className={`btn btn-sm ${d === days ? "btn-primary" : ""}`} href={href({ days: d })}>{d === 365 ? "1 year" : `${d} days`}</Link>
          ))}
        </div>
      </div>
      <StatRow items={[
        { label: kind === "clicks" ? "Clicks" : "Views", value: stats.total },
        { label: "Unique visitors", value: stats.unique },
        { label: "Countries", value: stats.countries.filter((c) => c.label !== "Unknown").length },
        { label: "Top referrer", value: stats.referrers[0]?.label ?? "None yet" },
      ]} />
      {empty ? (
        <div className="empty" style={{ marginTop: 32 }}>
          <h3>No {kind === "clicks" ? "clicks" : "views"} in this period</h3>
          <p>Share a short link or your bio page. Numbers appear here within a few seconds of the first visit. Bots are filtered out.</p>
        </div>
      ) : (
        <>
          <TimeSeries series={stats.series} label={`${kind === "clicks" ? "Clicks" : "Views"} per day`} />
          <div className="cols" style={{ marginTop: 40 }}>
            <BarList title="Countries" rows={stats.countries.map((c) => ({ ...c, label: countryName(c.label) }))} />
            <BarList title="Referrers" rows={stats.referrers} />
            <BarList title="Devices" rows={stats.devices} />
            <BarList title="Browsers" rows={stats.browsers} />
            {stats.campaigns.some((c) => c.label !== "No campaign") ? <BarList title="Campaigns (utm_campaign)" rows={stats.campaigns} /> : null}
          </div>
        </>
      )}
      <p className="small muted" style={{ marginTop: 32 }}>Visitors are counted with a hash that changes daily. IP addresses are never stored.</p>
    </>
  );
}
