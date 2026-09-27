import Link from "next/link";
import type { Roaster, RoasterStockist } from "@coffeesnob/supabase";
import {
  addRoasterAction,
  addStockistsAction,
  pinStockistAction,
  removeRoasterAction,
  removeStockistAction,
} from "./actions";
import type { LiveIndex, PlaceSummary, StockistMatch } from "./live-index";

type State = "needs-you" | "waiting" | "found" | "pinned";
type Row = RoasterStockist & { state: State; match?: StockistMatch };

// Each line's state against the live build. Lines added since that build
// wait for the next one; the admin's pin always wins.
function rowsFor(stockists: RoasterStockist[], live: LiveIndex | string): Row[] {
  const byId = new Map((typeof live === "string" ? [] : live.report.roasters?.stockists ?? []).map((m) => [m.id, m]));
  return stockists.map((s) => {
    const match = byId.get(s.id);
    const state: State = s.matchedId ? "pinned" : !match ? "waiting" : match.matchedId ? "found" : "needs-you";
    return { ...s, state, match };
  });
}

export function unmatchedStockistCount(stockists: RoasterStockist[], live: LiveIndex | string): number {
  return rowsFor(stockists, live).filter((r) => r.state === "needs-you").length;
}

const host = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const where = (p: PlaceSummary) => [p.address, p.locality, p.countryCode].filter(Boolean).join(", ") || "No address in the index";

function PinButton({ stockistId, place, label }: { stockistId: string; place: PlaceSummary; label: string }) {
  return (
    <form action={pinStockistAction} className="adm-row" style={{ alignItems: "flex-start" }}>
      <input type="hidden" name="stockistId" value={stockistId} />
      <input type="hidden" name="placeId" value={place.id} />
      <span className="body-sm" style={{ flex: 1 }}>
        <strong>{place.name}</strong>
        <span className="adm-meta" style={{ display: "block" }}>{where(place)}</span>
      </span>
      <button type="submit" className="btn btn-sm btn-line" aria-label={`${label}: ${place.name}, ${where(place)}`}>{label}</button>
    </form>
  );
}

function StockistRow({ row }: { row: Row }) {
  const others = row.match?.candidates ?? [];
  return (
    <tr>
      <td>
        <div className="adm-name">{row.rawName}</div>
        <div className="adm-meta">{row.rawAddress || "No address given"}</div>
      </td>
      <td>
        {row.state === "waiting" ? (
          <span className="adm-meta" style={{ marginTop: 0 }}>Matched at the next build</span>
        ) : row.state === "needs-you" ? (
          others.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              <span className="chip ox" style={{ justifySelf: "start" }}>Pick the café</span>
              {others.map((p) => <PinButton key={p.id} stockistId={row.id} place={p} label="This one" />)}
            </div>
          ) : (
            <span className="body-sm">
              <span className="chip ox">Not found</span>
              <span className="adm-meta" style={{ display: "block" }}>
                No café by that name in the index. Check the spelling against the café&apos;s sign and paste it again.
              </span>
            </span>
          )
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <span className="body-sm">
              <span className={`chip ${row.state === "pinned" ? "" : "bu"}`} style={{ marginRight: 6 }}>{row.state === "pinned" ? "Pinned" : "On the map"}</span>
              {row.match?.place && (row.state === "found" || row.match.matchedId === row.matchedId) ? (
                <>
                  <strong>{row.match.place.name}</strong>
                  <span className="adm-meta" style={{ display: "block" }}>{where(row.match.place)}</span>
                </>
              ) : (
                <span className="adm-meta" style={{ display: "block" }}>Shows as picked from the next build.</span>
              )}
            </span>
            {row.state === "found" && others.length ? (
              <details>
                <summary className="adm-meta" style={{ cursor: "pointer" }}>Wrong café?</summary>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {others.map((p) => <PinButton key={p.id} stockistId={row.id} place={p} label="Use this" />)}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </td>
      <td>
        <div className="adm-actions">
          {row.state === "pinned" ? (
            <form action={pinStockistAction}>
              <input type="hidden" name="stockistId" value={row.id} />
              <button type="submit" className="btn btn-sm btn-quiet" aria-label={`Unpin ${row.rawName}`}>Unpin</button>
            </form>
          ) : null}
          <form action={removeStockistAction}>
            <input type="hidden" name="stockistId" value={row.id} />
            <button type="submit" className="btn btn-sm btn-quiet" aria-label={`Remove ${row.rawName}`}>Remove</button>
          </form>
        </div>
      </td>
    </tr>
  );
}

const ORDER: State[] = ["needs-you", "waiting", "pinned", "found"];

function RoasterDetail({ roaster, stockists, live }: { roaster: Roaster; stockists: RoasterStockist[]; live: LiveIndex | string }) {
  const rows = rowsFor(stockists, live).sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.rawName.localeCompare(b.rawName));
  const own = typeof live === "string" ? 0 : live.report.roasters?.ownCafes[roaster.id] ?? 0;

  return (
    <div>
      <Link href="/admin/shops?tab=roasters" className="label">All roasters</Link>
      <div className="adm-grid" style={{ marginTop: 16 }}>
        <section className="adm-section" aria-labelledby="roaster-h">
          <h2 id="roaster-h" className="d3">{roaster.name}</h2>
          <p className="adm-meta">
            {[roaster.countryCode, roaster.website ? host(roaster.website) : null].filter(Boolean).join(" · ") || "No country or website"}
            {own ? ` · ${own} own café${own === 1 ? "" : "s"} found by website` : ""}
          </p>
          {roaster.notes ? <p className="body" style={{ marginTop: 10 }}>{roaster.notes}</p> : null}

          {rows.length === 0 ? (
            <div className="adm-empty">
              <p className="body">No stockists yet. Paste the list from the roaster&apos;s &ldquo;where to find us&rdquo; page.</p>
            </div>
          ) : (
            <table className="adm-table" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "46%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Their list says</th>
                  <th scope="col">On our map</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => <StockistRow key={r.id} row={r} />)}
              </tbody>
            </table>
          )}
        </section>

        <aside>
          <div className="adm-panel">
            <h2 className="d4">Add stockists</h2>
            <form action={addStockistsAction} style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input type="hidden" name="roasterId" value={roaster.id} />
              <label htmlFor="lines" className="body-sm">One café per line: name, then the address after a comma or a tab.</label>
              <textarea
                id="lines"
                name="lines"
                rows={8}
                required
                className="adm-input"
                style={{ height: "auto", padding: 10 }}
                placeholder={"Chrome Yellow, 501 Edgewood Ave, Atlanta\nSpiller Park, Ponce City Market"}
              />
              <button type="submit" className="btn btn-sm btn-ox" style={{ justifySelf: "start" }}>Add to list</button>
            </form>
            <p className="adm-meta" style={{ marginTop: 12 }}>
              Lines already on the list are skipped. Matches appear after the next monthly build, or run the coffee index workflow on GitHub to see them sooner.
            </p>
          </div>
          <div className="adm-panel">
            <form action={removeRoasterAction} className="adm-row">
              <input type="hidden" name="roasterId" value={roaster.id} />
              <span className="body-sm" style={{ flex: 1 }}>Removing the roaster drops its whole list.</span>
              <button type="submit" className="btn btn-sm btn-quiet">Remove roaster</button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function RoastersTab({
  roasters,
  stockists,
  live,
  open,
}: {
  roasters: Roaster[];
  stockists: RoasterStockist[];
  live: LiveIndex | string;
  open?: string;
}) {
  const current = roasters.find((r) => r.id === open);
  if (current) return <RoasterDetail roaster={current} stockists={stockists.filter((s) => s.roasterId === current.id)} live={live} />;

  return (
    <div className="adm-grid">
      <section className="adm-section" aria-labelledby="roasters-h">
        <h2 id="roasters-h" className="d3">Roasters we trust</h2>
        <p className="body">
          A café pouring a roaster we trust always shows on the map, with the roaster named as the reason. Paste each roaster&apos;s stockist list; the monthly build finds the cafés.
        </p>
        {roasters.length === 0 ? (
          <div className="adm-empty">
            <p className="body">No roasters yet. Start with the ones you already trust in the launch cities.</p>
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Roaster</th>
                <th scope="col" className="num">Stockists</th>
                <th scope="col">Last build</th>
                <th scope="col"><span className="visually-hidden">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {roasters.map((r) => {
                const rows = rowsFor(stockists.filter((s) => s.roasterId === r.id), live);
                const onMap = rows.filter((x) => x.state === "found" || x.state === "pinned").length;
                const needs = rows.filter((x) => x.state === "needs-you").length;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="adm-name">{r.name}</div>
                      <div className="adm-meta">{[r.countryCode, r.website ? host(r.website) : null].filter(Boolean).join(" · ") || "—"}</div>
                    </td>
                    <td className="num">{rows.length}</td>
                    <td>
                      <span className="body-sm">{onMap} on the map</span>
                      {needs ? <span className="chip ox" style={{ marginLeft: 8 }}>{needs} to check</span> : null}
                    </td>
                    <td>
                      <div className="adm-actions">
                        <Link href={`/admin/shops?tab=roasters&roaster=${r.id}`} className="btn btn-sm btn-quiet" aria-label={`Open ${r.name}`}>Open</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <aside>
        <div className="adm-panel">
          <h2 className="d4">Add a roaster</h2>
          <form action={addRoasterAction} style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <label className="visually-hidden" htmlFor="roaster-name">Name</label>
            <input id="roaster-name" name="name" required maxLength={200} placeholder="Name" className="adm-input" />
            <label className="visually-hidden" htmlFor="roaster-site">Website</label>
            <input id="roaster-site" name="website" maxLength={500} placeholder="Website (finds their own cafés)" className="adm-input" />
            <label className="visually-hidden" htmlFor="roaster-country">Country code</label>
            <input id="roaster-country" name="countryCode" maxLength={2} placeholder="Country (US, GB, …)" className="adm-input" />
            <label className="visually-hidden" htmlFor="roaster-notes">Notes</label>
            <textarea id="roaster-notes" name="notes" rows={3} maxLength={2000} placeholder="Why we trust them" className="adm-input" style={{ height: "auto", padding: 10 }} />
            <button type="submit" className="btn btn-sm btn-ox" style={{ justifySelf: "start" }}>Add roaster</button>
          </form>
        </div>
      </aside>
    </div>
  );
}
