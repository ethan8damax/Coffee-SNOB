import type { FreshnessShop } from "@coffeesnob/supabase";
import { closeShopAction, reopenShopAction, stillOpenAction } from "./actions";
import type { LiveIndex } from "./live-index";

// Rated shops never leave the map on their own: two builds without any
// source having them puts them here, and the admin decides.
const MIN_BUILDS = 2;

export type ClosedCandidate = FreshnessShop & { builds: number };

export function missingIds(live: LiveIndex | string): Map<string, number> {
  const list = typeof live === "string" ? [] : live.report.missingRated ?? [];
  return new Map(list.filter((m) => m.builds >= MIN_BUILDS).map((m) => [m.externalId, m.builds]));
}

// "Still open" hides a shop until a build newer than that call still misses it.
export function closedCandidates(shops: FreshnessShop[], live: LiveIndex | string): ClosedCandidate[] {
  const builds = missingIds(live);
  const builtAt = typeof live === "string" ? "" : live.manifest.builtAt;
  return shops
    .filter((s) => !s.closedAt && (!s.openCheckedAt || s.openCheckedAt < builtAt))
    .map((s) => ({ ...s, builds: builds.get(s.externalId ?? "") ?? 0 }))
    .filter((s) => s.builds >= MIN_BUILDS)
    .sort((a, b) => b.builds - a.builds || a.name.localeCompare(b.name));
}

const where = (s: FreshnessShop) => [s.locality, s.region].filter(Boolean).join(", ") || "City unknown";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function ClosedTab({ candidates, closed, live }: { candidates: ClosedCandidate[]; closed: FreshnessShop[]; live: LiveIndex | string }) {
  return (
    <div className="adm-grid">
      <section className="adm-section" aria-labelledby="closed-h">
        <h2 id="closed-h" className="d3">Possibly closed</h2>
        <p className="body">
          Rated shops that OpenStreetMap and Overture have both dropped for two monthly builds running. They stay on the map until you decide.
        </p>
        {live === "unconfigured" || live === "unavailable" ? (
          <div className="adm-empty">
            <p className="body">This list comes from the monthly build report, which isn&apos;t reachable right now.</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="adm-empty">
            <p className="body">Every rated shop is still in the sources. A shop shows up here after two builds without it.</p>
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Shop</th>
                <th scope="col">Missing for</th>
                <th scope="col"><span className="visually-hidden">Decision</span></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="adm-name">{s.name}</div>
                    <div className="adm-meta">{where(s)}</div>
                  </td>
                  <td>{s.builds} builds</td>
                  <td>
                    <div className="adm-actions">
                      <form action={closeShopAction}>
                        <input type="hidden" name="shopId" value={s.id} />
                        <button type="submit" className="btn btn-sm btn-ox" aria-label={`${s.name} is closed`}>Closed</button>
                      </form>
                      <form action={stillOpenAction}>
                        <input type="hidden" name="shopId" value={s.id} />
                        <button type="submit" className="btn btn-sm btn-quiet" aria-label={`${s.name} is still open`}>Still open</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <aside>
        <div className="adm-panel">
          <h2 className="d4">
            Marked closed <span className="adm-count quiet">{closed.length}</span>
          </h2>
          {closed.length === 0 ? (
            <p className="body-sm" style={{ color: "var(--ink-2)", marginTop: 8 }}>
              None. A closed shop leaves the map and city pages; its logs stay on people&apos;s profiles.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
              {closed.map((s) => (
                <li key={s.id} className="adm-row">
                  <span className="body-sm" style={{ flex: 1 }}>
                    <strong>{s.name}</strong>
                    <span className="adm-meta" style={{ display: "block" }}>{where(s)} · closed {day(s.closedAt!)}</span>
                  </span>
                  <form action={reopenShopAction}>
                    <input type="hidden" name="shopId" value={s.id} />
                    <button type="submit" className="btn btn-sm btn-quiet" aria-label={`Reopen ${s.name}`}>Reopen</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
