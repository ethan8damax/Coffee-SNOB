import Link from "next/link";
import type { ShopSubmission } from "@coffeesnob/supabase";
import { metersBetween } from "@/lib/lat-lng";
import { adminAddShopAction, approveSubmissionAction, declineSubmissionAction } from "./actions";
import type { LiveIndex } from "./live-index";

// Add a shop (0036): what people sent, oldest first. Open one, check it
// against what's already close by, fix what needs fixing, then decide.

export type Nearby = { name: string; meters: number; source: "ours" | "index"; href?: string };

const NEAR_METERS = 150;
const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};
const where = (s: ShopSubmission) => [s.locality, s.region].filter(Boolean).join(", ") || "City unknown";
const sender = (s: ShopSubmission) => (s.sender ? `@${s.sender}` : "someone");

// Coffee-index cafés within reach of a spot, from the 1° name-search file.
export async function indexNear(live: LiveIndex | string, lat: number, lng: number): Promise<Nearby[]> {
  if (typeof live === "string") return [];
  try {
    const res = await fetch(`${live.origin}/v/${live.manifest.version}/search/${Math.floor(lat)}_${Math.floor(lng)}.json`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const rows = (await res.json()) as [string, string, number, number][];
    return rows
      .map(([, name, pLat, pLng]) => ({ name, meters: metersBetween({ lat, lng }, { lat: pLat, lng: pLng }), source: "index" as const }))
      .filter((p) => p.meters <= NEAR_METERS);
  } catch {
    return [];
  }
}

export function AddedTab({
  pending,
  decided,
  open,
  nearby,
  flash,
}: {
  pending: ShopSubmission[];
  decided: ShopSubmission[];
  open: ShopSubmission | null;
  nearby: Nearby[];
  flash: { done?: string; error?: string };
}) {
  return (
    <div className="adm-grid">
      <section className="adm-section" aria-labelledby="added-h">
        <h2 id="added-h" className="d3">Waiting for a look</h2>
        <p className="body">Shops people say the map is missing. Nothing goes live until you put it there; the sender hears either way.</p>
        <Flash {...flash} />

        {open ? <Review s={open} nearby={nearby} /> : null}

        {pending.length === 0 ? (
          <div className="adm-empty">
            <p className="body">Nothing waiting. People add shops from the map&apos;s search (&ldquo;Not on the map? Add it&rdquo;).</p>
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Shop</th>
                <th scope="col">Sent by</th>
                <th scope="col"><span className="visually-hidden">Review</span></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((s) => (
                <tr key={s.id} aria-current={open?.id === s.id ? "true" : undefined} style={open?.id === s.id ? { background: "var(--card)" } : undefined}>
                  <td>
                    <div className="adm-name">{s.name}</div>
                    <div className="adm-meta">{s.address ? `${s.address}, ${where(s)}` : where(s)}</div>
                  </td>
                  <td>
                    {sender(s)}
                    <div className="adm-meta">{ago(s.createdAt)}</div>
                  </td>
                  <td>
                    <div className="adm-actions">
                      <Link href={`/admin/shops?tab=added&sub=${s.id}`} className="btn btn-sm btn-line" aria-label={`Review ${s.name}`}>
                        Review
                      </Link>
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
          <h2 className="d4">Add one yourself</h2>
          <p className="body-sm" style={{ color: "var(--ink-2)", marginTop: 6 }}>
            Goes live right away. Paste the spot from any map: &ldquo;27.9601, -82.4590&rdquo; or a Google Maps link.
          </p>
          <form action={adminAddShopAction} style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <Field id="new-name" label="Name">
              <input id="new-name" name="name" required minLength={2} maxLength={120} className="adm-input" placeholder="Wuz Here Coffee" />
            </Field>
            <Field id="new-spot" label="Spot">
              <input id="new-spot" name="latLng" required className="adm-input" placeholder="27.9601, -82.4590" />
            </Field>
            <Field id="new-address" label="Address (optional, filled from the spot if blank)">
              <input id="new-address" name="address" maxLength={300} className="adm-input" />
            </Field>
            <Field id="new-website" label="Website (optional)">
              <input id="new-website" name="website" type="url" maxLength={500} className="adm-input" placeholder="https://" />
            </Field>
            <Field id="new-hours" label="Hours (optional)">
              <input id="new-hours" name="hours" maxLength={500} className="adm-input" placeholder="Mo-Fr 07:00-15:00; Sa,Su 08:00-14:00" />
            </Field>
            <button type="submit" className="btn btn-sm btn-ox" style={{ justifySelf: "start", marginTop: 4 }}>
              Put it on the map
            </button>
          </form>
        </div>

        <div className="adm-panel">
          <h2 className="d4">
            Decided <span className="adm-count quiet">{decided.length}</span>
          </h2>
          {decided.length === 0 ? (
            <p className="body-sm" style={{ color: "var(--ink-2)", marginTop: 8 }}>Nothing yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
              {decided.map((s) => (
                <li key={s.id} className="body-sm">
                  <strong>{s.name}</strong> <span className={`chip ${s.status === "approved" ? "on" : ""}`} style={{ marginLeft: 6 }}>{s.status === "approved" ? "On the map" : "Passed"}</span>
                  <span className="adm-meta" style={{ display: "block" }}>
                    {where(s)} · {sender(s)}
                    {s.declineReason ? ` · “${s.declineReason}”` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function Review({ s, nearby }: { s: ShopSubmission; nearby: Nearby[] }) {
  const d = 0.0025;
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${s.lng - d},${s.lat - d},${s.lng + d},${s.lat + d}&layer=mapnik&marker=${s.lat},${s.lng}`;
  const spot = `${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}`;
  return (
    <div className="adm-panel" style={{ marginTop: 20 }}>
      <div className="adm-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 className="d4">{s.name}</h3>
        <Link href="/admin/shops?tab=added" className="label">Close</Link>
      </div>
      <p className="adm-meta">
        Sent by {sender(s)} {ago(s.createdAt)} · {where(s)}
      </p>

      <iframe title={`Map of where ${s.name} was pinned`} src={embed} style={{ width: "100%", height: 240, border: "1px solid var(--rule)", borderRadius: 2, marginTop: 14, display: "block" }} loading="lazy" />
      <p className="adm-meta">
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.lat},${s.lng}`)}`} target="_blank" rel="noreferrer">
          Look it up on Google Maps
        </a>
        {s.website ? (
          <>
            {" · "}
            <a href={s.website} target="_blank" rel="noreferrer">{s.website.replace(/^https?:\/\/(www\.)?/, "")}</a>
          </>
        ) : null}
      </p>

      {s.roaster || s.note ? (
        <dl className="adm-kv">
          {s.roaster ? (
            <>
              <dt>Pours</dt>
              <dd>{s.roaster}</dd>
            </>
          ) : null}
          {s.note ? (
            <>
              <dt>Their note</dt>
              <dd>{s.note}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      <h4 className="label" style={{ marginTop: 20 }}>Close by</h4>
      {nearby.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--ink-2)", marginTop: 6 }}>Nothing within {NEAR_METERS} m on our map or in the coffee index.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 6 }}>
          {nearby.map((n, i) => (
            <li key={i} className="body-sm">
              {n.href ? <a href={n.href} target="_blank" rel="noreferrer"><strong>{n.name}</strong></a> : <strong>{n.name}</strong>} · {Math.round(n.meters)} m ·{" "}
              <span className="adm-meta" style={{ display: "inline" }}>{n.source === "ours" ? "already a shop here" : "in the coffee index"}</span>
            </li>
          ))}
        </ul>
      )}

      <form action={approveSubmissionAction} style={{ display: "grid", gap: 8, marginTop: 20 }}>
        <input type="hidden" name="id" value={s.id} />
        <Field id="sub-name" label="Name">
          <input id="sub-name" name="name" defaultValue={s.name} required minLength={2} maxLength={120} className="adm-input" />
        </Field>
        <Field id="sub-spot" label="Spot">
          <input id="sub-spot" name="latLng" defaultValue={spot} required className="adm-input" />
        </Field>
        <Field id="sub-address" label="Address">
          <input id="sub-address" name="address" defaultValue={s.address ?? ""} maxLength={300} className="adm-input" />
        </Field>
        <Field id="sub-website" label="Website">
          <input id="sub-website" name="website" defaultValue={s.website ?? ""} type="url" maxLength={500} className="adm-input" />
        </Field>
        <Field id="sub-hours" label="Hours">
          <input id="sub-hours" name="hours" defaultValue={s.hours ?? ""} maxLength={500} className="adm-input" placeholder="Mo-Fr 07:00-15:00" />
        </Field>
        <button type="submit" className="btn btn-ox" style={{ justifySelf: "start", marginTop: 4 }}>
          Put it on the map
        </button>
      </form>

      <form action={declineSubmissionAction} style={{ display: "grid", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rule)" }}>
        <input type="hidden" name="id" value={s.id} />
        <Field id="sub-reason" label="Or pass. The sender sees this line (optional).">
          <input id="sub-reason" name="reason" maxLength={300} className="adm-input" placeholder="Already on the map as Two Fold Coffee." />
        </Field>
        <button type="submit" className="btn btn-sm btn-quiet" style={{ justifySelf: "start" }}>
          Pass on it
        </button>
      </form>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <label htmlFor={id} className="label" style={{ color: "var(--ink-2)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const FLASH: Record<string, string> = {
  approved: "On the map. The sender will see it at the top of their feed.",
  declined: "Passed. The sender will see your line.",
  added: "On the map.",
  spot: "Couldn't read that spot. Paste “lat, lng” or a map link.",
  name: "A shop needs a name.",
  chain: "That's a chain. Chains can't be added.",
  save: "Couldn't save that. Give it another go.",
};

function Flash({ done, error }: { done?: string; error?: string }) {
  const key = error ?? done;
  if (!key || !FLASH[key]) return null;
  return (
    <p role={error ? "alert" : "status"} className="body-sm" style={{ marginTop: 14, padding: "10px 12px", borderRadius: 2, background: error ? "var(--oxblood)" : "var(--card)", color: error ? "var(--cream)" : "var(--ink)", border: error ? 0 : "1px solid var(--rule)" }}>
      {FLASH[key]}
    </p>
  );
}
