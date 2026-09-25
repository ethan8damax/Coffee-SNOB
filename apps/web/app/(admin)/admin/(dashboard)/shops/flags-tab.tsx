import type { PlaceFlag, PlaceFlagKind, PlaceOverride } from "@coffeesnob/supabase";
import { dismissFlagsAction, hideFlaggedPlaceAction, removeOverrideAction } from "./actions";

const KIND_LABEL: Record<PlaceFlagKind, string> = { closed: "Closed", not_specialty: "Not specialty", wrong_location: "Wrong spot" };

type Group = { placeId: string; name: string; lat: number; lng: number; counts: Record<PlaceFlagKind, number>; latest: string; total: number };

export function groupFlags(flags: PlaceFlag[]): Group[] {
  const byPlace = new Map<string, Group>();
  for (const f of flags) {
    const g = byPlace.get(f.placeId) ?? {
      placeId: f.placeId, name: f.placeName, lat: f.lat, lng: f.lng,
      counts: { closed: 0, not_specialty: 0, wrong_location: 0 }, latest: f.createdAt, total: 0,
    };
    g.counts[f.kind]++;
    g.total++;
    if (f.createdAt > g.latest) g.latest = f.createdAt;
    byPlace.set(f.placeId, g);
  }
  // Two "closed" reports already hide a place on the map, so those come first.
  return [...byPlace.values()].sort((a, b) => Number(b.counts.closed >= 2) - Number(a.counts.closed >= 2) || b.latest.localeCompare(a.latest));
}

const osm = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function FlagsTab({ flags, overrides }: { flags: PlaceFlag[]; overrides: PlaceOverride[] }) {
  const groups = groupFlags(flags);
  const hidden = overrides.filter((o) => o.action === "hide");

  return (
    <div className="adm-grid">
      <section className="adm-section" aria-labelledby="flags-h">
        <h2 id="flags-h" className="d3">Reports from people on the map</h2>
        <p className="body">
          Two different people saying &ldquo;closed&rdquo; already hides a place until you decide. Hide keeps it off for good; dismiss puts it back.
        </p>
        {groups.length === 0 ? (
          <div className="adm-empty">
            <p className="body">No open reports. They show up here when someone taps &ldquo;Something off?&rdquo; on a café.</p>
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Place</th>
                <th scope="col">Reported</th>
                <th scope="col"><span className="visually-hidden">Decision</span></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.placeId}>
                  <td>
                    <div className="adm-name">{g.name}</div>
                    <div className="adm-meta">
                      <a href={osm(g.lat, g.lng)} target="_blank" rel="noopener">See the spot</a> · last {day(g.latest)}
                    </div>
                  </td>
                  <td>
                    {(Object.keys(KIND_LABEL) as PlaceFlagKind[])
                      .filter((k) => g.counts[k])
                      .map((k) => (
                        <span key={k} className={`chip ${k === "closed" && g.counts[k] >= 2 ? "ox" : ""}`} style={{ marginRight: 6 }}>
                          {KIND_LABEL[k]} {g.counts[k]}
                        </span>
                      ))}
                  </td>
                  <td>
                    <div className="adm-actions">
                      <form action={hideFlaggedPlaceAction}>
                        <input type="hidden" name="placeId" value={g.placeId} />
                        <input type="hidden" name="reason" value={Object.entries(g.counts).filter(([, n]) => n).map(([k]) => k).join(", ")} />
                        <button type="submit" className="btn btn-sm btn-ox" aria-label={`Hide ${g.name}`}>Hide</button>
                      </form>
                      <form action={dismissFlagsAction}>
                        <input type="hidden" name="placeId" value={g.placeId} />
                        <button type="submit" className="btn btn-sm btn-quiet" aria-label={`Dismiss reports on ${g.name}`}>Dismiss</button>
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
            Hidden by you <span className="adm-count quiet">{hidden.length}</span>
          </h2>
          {hidden.length === 0 ? (
            <p className="body-sm" style={{ color: "var(--ink-2)", marginTop: 8 }}>Nothing hidden. Places you hide from a report land here.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
              {hidden.map((o) => (
                <li key={o.placeId} className="adm-row">
                  <span className="body-sm" style={{ flex: 1 }}>
                    <code>{o.placeId}</code>
                    {o.reason ? <span className="adm-meta" style={{ display: "block" }}>{o.reason.replace(/_/g, " ")}</span> : null}
                  </span>
                  <form action={removeOverrideAction}>
                    <input type="hidden" name="placeId" value={o.placeId} />
                    <button type="submit" className="btn btn-sm btn-quiet">Unhide</button>
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
