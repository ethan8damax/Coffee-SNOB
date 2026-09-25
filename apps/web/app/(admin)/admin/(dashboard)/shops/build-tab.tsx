import type { LiveIndex } from "./live-index";

const n = (x: number) => x.toLocaleString("en-US");

export function BuildTab({ live }: { live: LiveIndex | string }) {
  if (typeof live === "string") {
    return (
      <section className="adm-section">
        <h2 className="d3">Monthly build</h2>
        <div className="adm-empty">
          <p className="body">
            {live === "unconfigured"
              ? "The report shows up once the coffee index is published and COFFEE_INDEX_ORIGIN is set for this site."
              : "Couldn't reach the coffee index just now. Try again in a minute."}
          </p>
        </div>
      </section>
    );
  }

  const { manifest, report, origin } = live;
  const countries = Object.entries(report.byCountry).sort((a, b) => b[1] - a[1]);
  const base = `${origin}/v/${manifest.version}`;
  const change =
    report.added === null ? "First build" : `+${n(report.added)} new · −${n(report.removed ?? 0)} gone`;

  return (
    <div className="adm-grid">
      <section className="adm-section" aria-labelledby="build-h">
        <h2 id="build-h" className="d3">Monthly build</h2>
        <p className="body">Rebuilt on the 25th from OpenStreetMap and Overture. Rated shops live in our database and never depend on it.</p>
        {report.alarm ? <p className="adm-alarm">Held back: {report.alarm}. Last month&apos;s map is still live.</p> : null}
        <dl className="adm-kv">
          <dt>Built</dt>
          <dd>{new Date(manifest.builtAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</dd>
          <dt>Cafés</dt>
          <dd><span className="num">{n(report.count)}</span></dd>
          <dt>Since last</dt>
          <dd>{change}</dd>
          <dt>Sources</dt>
          <dd>{Object.entries(manifest.sources).map(([k, v]) => `${k} ${v.slice(0, 10)}`).join(" · ")}</dd>
          <dt>Dense areas</dt>
          <dd>{manifest.split.length} cells split for faster loading</dd>
          <dt>Files</dt>
          <dd>
            <a href={`${base}/report.md`} target="_blank" rel="noopener">Full report</a> ·{" "}
            <a href={`${base}/places.ndjson.gz`}>Download the index</a>
          </dd>
        </dl>
      </section>

      <aside>
        <div className="adm-panel">
          <h2 className="d4">Where the cafés are</h2>
          <table className="adm-table keep">
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col" className="num">Cafés</th>
              </tr>
            </thead>
            <tbody>
              {countries.slice(0, 15).map(([code, count]) => (
                <tr key={code}>
                  <td>{code === "??" ? "Unknown" : code}</td>
                  <td className="num">{n(count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {countries.length > 15 ? <p className="adm-meta" style={{ marginTop: 10 }}>And {countries.length - 15} more countries.</p> : null}
        </div>
      </aside>
    </div>
  );
}
