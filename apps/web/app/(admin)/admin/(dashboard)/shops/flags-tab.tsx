import Link from "next/link";
import type { PlaceFlag, PlaceFlagKind, PlaceOverride } from "@coffeesnob/supabase";
import { doneFlagsAction, hideFlaggedPlaceAction, passFlagsAction, removeOverrideAction } from "./actions";
import { Flash } from "./added-tab";

const KIND_LABEL: Record<PlaceFlagKind, string> = {
  closed: "Closed",
  wrong_location: "Moved",
  not_specialty: "Not specialty",
  wrong_info: "Wrong info",
  duplicate: "Duplicate",
  other: "Other",
};

// One row per place or shop, however many people and reasons.
type Group = {
  key: string;
  placeId: string | null;
  shopId: string | null;
  name: string;
  lat: number;
  lng: number;
  counts: Partial<Record<PlaceFlagKind, number>>;
  notes: string[];
  latest: string;
};

export function groupFlags(flags: PlaceFlag[]): Group[] {
  const byTarget = new Map<string, Group>();
  for (const f of flags) {
    const key = f.shopId ?? f.placeId!;
    const g = byTarget.get(key) ?? { key, placeId: f.placeId, shopId: f.shopId, name: f.placeName, lat: f.lat, lng: f.lng, counts: {}, notes: [], latest: f.createdAt };
    g.counts[f.kind] = (g.counts[f.kind] ?? 0) + 1;
    if (f.note) g.notes.push(f.note);
    if (f.createdAt > g.latest) g.latest = f.createdAt;
    byTarget.set(key, g);
  }
  // Two "closed" reports already hide an index café, so those come first.
  const hiding = (g: Group) => Number(g.placeId !== null && (g.counts.closed ?? 0) >= 2);
  return [...byTarget.values()].sort((a, b) => hiding(b) - hiding(a) || b.latest.localeCompare(a.latest));
}

const osm = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Target({ g }: { g: Group }) {
  return g.shopId ? <input type="hidden" name="shopId" value={g.shopId} /> : <input type="hidden" name="placeId" value={g.placeId!} />;
}

export function FlagsTab({ flags, overrides, flash }: { flags: PlaceFlag[]; overrides: PlaceOverride[]; flash: { done?: string; error?: string } }) {
  const groups = groupFlags(flags);
  const hidden = overrides.filter((o) => o.action === "hide");

  return (
    <div className="adm-grid">
      <section className="adm-section" aria-labelledby="flags-h">
        <h2 id="flags-h" className="d3">Shop problems</h2>
        <p className="body">
          What people flagged with &ldquo;Something off?&rdquo;. Two people saying a café is closed already hides it until you decide. Everyone who reported it hears
          what you did.
        </p>
        <Flash {...flash} />
        {groups.length === 0 ? (
          <div className="adm-empty">
            <p className="body">No open reports. They show up here when someone taps &ldquo;Something off?&rdquo; on a shop.</p>
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Shop</th>
                <th scope="col">Reported</th>
                <th scope="col"><span className="visually-hidden">Decision</span></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.key}>
                  <td>
                    <div className="adm-name">{g.name}</div>
                    <div className="adm-meta">
                      {g.shopId ? "Our shop" : "Index café"} · <a href={osm(g.lat, g.lng)} target="_blank" rel="noopener">See the spot</a> · last {day(g.latest)}
                    </div>
                    {g.notes.map((n, i) => (
                      <p key={i} className="body-sm" style={{ margin: "6px 0 0", color: "var(--ink-2)" }}>&ldquo;{n}&rdquo;</p>
                    ))}
                  </td>
                  <td>
                    {(Object.keys(KIND_LABEL) as PlaceFlagKind[])
                      .filter((k) => g.counts[k])
                      .map((k) => (
                        <span key={k} className={`chip ${k === "closed" && g.placeId && (g.counts[k] ?? 0) >= 2 ? "ox" : ""}`} style={{ marginRight: 6, marginBottom: 4 }}>
                          {KIND_LABEL[k]} {g.counts[k]}
                        </span>
                      ))}
                  </td>
                  <td>
                    <div className="adm-actions" style={{ flexWrap: "wrap" }}>
                      {g.placeId ? (
                        <form action={hideFlaggedPlaceAction}>
                          <Target g={g} />
                          <input type="hidden" name="reason" value={Object.keys(g.counts).join(", ")} />
                          <button type="submit" className="btn btn-sm btn-ox" aria-label={`Hide ${g.name}`}>Hide</button>
                        </form>
                      ) : (
                        <>
                          <Link href={`/admin/shops?tab=shops&edit=${g.shopId}`} className="btn btn-sm btn-line" aria-label={`Edit ${g.name}`}>Edit</Link>
                          <form action={doneFlagsAction}>
                            <Target g={g} />
                            <button type="submit" className="btn btn-sm btn-ox" aria-label={`Mark reports on ${g.name} fixed`}>Fixed</button>
                          </form>
                        </>
                      )}
                      <details>
                        <summary className="btn btn-sm btn-quiet" style={{ listStyle: "none" }}>Pass</summary>
                        <form action={passFlagsAction} style={{ display: "grid", gap: 6, marginTop: 8, minWidth: 220 }}>
                          <Target g={g} />
                          <label htmlFor={`why-${g.key}`} className="visually-hidden">Why (they&apos;ll see it)</label>
                          <input id={`why-${g.key}`} name="reason" maxLength={300} className="adm-input" placeholder="Why, in a line. They'll see it." />
                          <button type="submit" className="btn btn-sm btn-line" style={{ justifySelf: "start" }}>Pass</button>
                        </form>
                      </details>
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
