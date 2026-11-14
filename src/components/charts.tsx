import type { Stats } from "@/lib/analytics";

/** Server-rendered SVG line chart: total clicks (solid) and unique visitors (dashed). No client JS. */
export function TimeSeries({ series, label }: { series: Stats["series"]; label: string }) {
  const W = 720, H = 220, L = 36, R = 8, T = 12, B = 24;
  const max = Math.max(1, ...series.map((s) => s.total));
  const nice = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const x = (i: number) => L + (series.length <= 1 ? 0 : (i / (series.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / nice) * (H - T - B);
  const line = (k: "total" | "unique") => series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join(" ");
  const area = `${line("total")} L${x(series.length - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(nice * f));
  const labelIdx = [0, Math.floor((series.length - 1) / 2), series.length - 1];
  const total = series.reduce((a, s) => a + s.total, 0);
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}. ${total} in total over ${series.length} days.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <path className="fill" d={area} />
        <path className="a" d={line("total")} />
        <path className="u" d={line("unique")} />
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}>
            {series[i]?.day.slice(5)}
          </text>
        ))}
      </svg>
      <figcaption className="legend"><span><i />Total</span><span><i className="u" />Unique visitors</span></figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Day</th><th>Total</th><th>Unique</th></tr></thead>
        <tbody>{series.map((s) => <tr key={s.day}><td>{s.day}</td><td>{s.total}</td><td>{s.unique}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export function BarList({ title, rows, empty = "No data in this period." }: { title: string; rows: { label: string; n: number }[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section>
      <div className="section-title"><h3>{title}</h3></div>
      {rows.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <ul className="bars">
          {rows.map((r) => (
            <li key={r.label}>
              <span className="t">{r.label}</span>
              <span className="num">{r.n.toLocaleString("en-US")}</span>
              <span className="b" aria-hidden="true"><i style={{ width: `${(r.n / max) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StatRow({ items }: { items: { label: string; value: number | string }[] }) {
  return (
    <div className="stats">
      {items.map((i) => (
        <div className="stat" key={i.label}>
          <div className="v">{typeof i.value === "number" ? i.value.toLocaleString("en-US") : i.value}</div>
          <div className="l">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
