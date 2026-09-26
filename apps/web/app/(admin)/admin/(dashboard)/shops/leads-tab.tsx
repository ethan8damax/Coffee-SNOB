import Link from "next/link";
import type { Lead } from "@coffeesnob/supabase";
import { Detour } from "@/components/primitives";
import { addVisitAction, rejectLeadAction, removeVisitAction } from "./actions";

// CURATION-STANDARDS: new shops wait ninety days; nothing is listed on one visit.
const WAIT_DAYS = 90;
const VISITS_NEEDED = 2;

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const where = (l: Lead) => [l.locality, l.region].filter(Boolean).join(", ");

export function readyLeadCount(leads: Lead[]): number {
  return leads.filter((l) => daysSince(l.firstLogAt) >= WAIT_DAYS).length;
}

function LeadRow({ lead }: { lead: Lead }) {
  const done = lead.visits.length >= VISITS_NEEDED;
  return (
    <tr>
      <td>
        <div className="adm-name">{lead.name}</div>
        <div className="adm-meta">
          {where(lead) || "City unknown"} · first logged {daysSince(lead.firstLogAt)} days ago
        </div>
      </td>
      <td>
        {/* The community's verdict on our own effort scale: never a number. */}
        <Detour value={Math.min(5, Math.max(1, Math.round(lead.adjusted)))} short />
        <div className="adm-meta">{lead.loggers} people</div>
      </td>
      <td>
        <div style={{ display: "grid", gap: 6 }}>
          {lead.visits.map((v, i) => (
            <form key={v.id} action={removeVisitAction} className="adm-row" style={{ alignItems: "flex-start" }}>
              <input type="hidden" name="visitId" value={v.id} />
              <span className="body-sm" style={{ flex: 1 }}>
                <strong>Visit {i + 1}</strong> · {day(v.visitedOn)}
                {v.notes ? <span className="adm-meta" style={{ display: "block" }}>{v.notes}</span> : null}
              </span>
              <button type="submit" className="btn btn-sm btn-quiet" aria-label={`Remove visit ${i + 1} to ${lead.name}`}>Remove</button>
            </form>
          ))}
          {!done ? (
            <details>
              <summary className="chip" style={{ cursor: "pointer", listStyle: "none" }}>
                Log visit {lead.visits.length + 1}
              </summary>
              <form action={addVisitAction} style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <input type="hidden" name="shopId" value={lead.id} />
                <label className="visually-hidden" htmlFor={`visited-${lead.id}`}>Visit date</label>
                <input id={`visited-${lead.id}`} type="date" name="visitedOn" required className="adm-input" defaultValue={new Date().toISOString().slice(0, 10)} />
                <label className="visually-hidden" htmlFor={`notes-${lead.id}`}>Notes</label>
                <textarea
                  id={`notes-${lead.id}`}
                  name="notes"
                  rows={3}
                  maxLength={2000}
                  placeholder="Sourcing, roast, the bar, consistency."
                  className="adm-input"
                  style={{ height: "auto", padding: 10 }}
                />
                <button type="submit" className="btn btn-sm btn-line" style={{ justifySelf: "start" }}>Save visit</button>
              </form>
            </details>
          ) : null}
        </div>
      </td>
      <td>
        <div className="adm-actions">
          {done ? (
            <Link href={`/admin/shops?tab=shops&edit=${lead.id}`} className="btn btn-sm btn-ox" aria-label={`Approve ${lead.name}`}>
              Approve
            </Link>
          ) : (
            <span className="adm-meta" style={{ marginTop: 0, alignSelf: "center" }}>
              {VISITS_NEEDED - lead.visits.length} visit{VISITS_NEEDED - lead.visits.length === 1 ? "" : "s"} to go
            </span>
          )}
          <form action={rejectLeadAction}>
            <input type="hidden" name="id" value={lead.id} />
            <button type="submit" className="btn btn-sm btn-quiet" aria-label={`${lead.name} is not a fit`}>Not a fit</button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function LeadTable({ leads }: { leads: Lead[] }) {
  return (
    <table className="adm-table" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "28%" }} />
        <col style={{ width: "18%" }} />
        <col style={{ width: "34%" }} />
        <col style={{ width: "20%" }} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Shop</th>
          <th scope="col">Community</th>
          <th scope="col">Visits</th>
          <th scope="col"><span className="visually-hidden">Decision</span></th>
        </tr>
      </thead>
      <tbody>
        {leads.map((l) => (
          <LeadRow key={l.id} lead={l} />
        ))}
      </tbody>
    </table>
  );
}

export function LeadsTab({ leads }: { leads: Lead[] }) {
  const ready = leads.filter((l) => daysSince(l.firstLogAt) >= WAIT_DAYS);
  const waiting = leads.filter((l) => daysSince(l.firstLogAt) < WAIT_DAYS);

  return (
    <div>
      <section className="adm-section" aria-labelledby="leads-h">
        <h2 id="leads-h" className="d3">Worth a visit</h2>
        <p className="body">
          Shops at least five different people rate highly, with one person counted once and brand-new accounts left out. Two visits, then approve or pass.
        </p>
        {ready.length === 0 ? (
          <div className="adm-empty">
            <p className="body">
              {waiting.length
                ? "Nothing's been open long enough yet. The shops below become visitable at ninety days."
                : "No shop has cleared the bar yet. Shops land here on their own once enough people rate them well."}
            </p>
          </div>
        ) : (
          <LeadTable leads={ready} />
        )}
      </section>

      {waiting.length ? (
        <section className="adm-section" aria-labelledby="waiting-h">
          <h2 id="waiting-h" className="d4">Too new to visit</h2>
          <p className="body">Rated well, but first logged under ninety days ago. Opening quality isn&apos;t steady-state quality.</p>
          <LeadTable leads={waiting} />
        </section>
      ) : null}
    </div>
  );
}
