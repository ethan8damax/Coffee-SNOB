import { isChain, normalizeChainName } from "@coffeesnob/coffee-index";
import type { ChainDecision } from "@coffeesnob/supabase";
import { lookupChain } from "@/lib/chain-lookup";
import { blockChainAction, decideSuggestionAction, unblockChainAction } from "./actions";
import { groupSuggestions, type LiveIndex } from "./live-index";

const SHOWN = 60;
const titleCase = (s: string) => s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());

type Kind = "prefix" | "brand" | "name";

// Suggestions come from the monthly build; decisions made since then are
// applied here right away so a decided row never lingers.
function pending(live: LiveIndex, decisions: ChainDecision[]) {
  const blocked = decisions.filter((c) => c.status === "blocked");
  return groupSuggestions(live.report.suggestedChains)
    .map((g) => {
      const kind: Kind = blocked.some((c) => c.wikidata && c.name === g.key) ? "prefix" : /^Q\d+$/.test(g.key) ? "brand" : "name";
      return { ...g, kind };
    })
    .filter((g) =>
      g.kind === "prefix"
        ? !blocked.some((c) => c.name === g.key && c.prefix) && !decisions.some((c) => c.name === `${g.key} …`)
        : !decisions.some((c) => c.wikidata === g.key) && !isChain({ name: g.name }, decisions),
    );
}

export function pendingChainCount(live: LiveIndex | string, decisions: ChainDecision[]): number {
  return typeof live === "string" ? 0 : pending(live, decisions).length;
}

export async function ChainsTab({ live, decisions, lookup }: { live: LiveIndex | string; decisions: ChainDecision[]; lookup?: string }) {
  const rows = typeof live === "string" ? [] : pending(live, decisions);
  const blocked = decisions.filter((c) => c.status === "blocked");
  const allowed = decisions.filter((c) => c.status === "allowed");
  const matches = lookup ? await lookupChain(lookup) : [];

  return (
    <div className="adm-grid">
      <section className="adm-section" aria-labelledby="suggested-h">
        <h2 id="suggested-h" className="d3">Suggested by the last build</h2>
        <p className="body">
          Names that show up more than ten times in one country. Block the chains; allow the rest so they stop coming back.
          {typeof live !== "string" ? ` From the ${new Date(live.manifest.builtAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} build.` : ""}
        </p>

        {live === "unconfigured" ? (
          <div className="adm-empty">
            <p className="body">Suggestions appear once the coffee index is published and <code>COFFEE_INDEX_ORIGIN</code> is set for this site.</p>
          </div>
        ) : live === "unavailable" ? (
          <div className="adm-empty">
            <p className="body">Couldn&apos;t reach the coffee index just now. Suggestions come back when it answers; nothing is lost.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="adm-empty">
            <p className="body">Every suggestion from this build has a decision. The next build brings new ones.</p>
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Where</th>
                <th scope="col" className="num">Places</th>
                <th scope="col"><span className="visually-hidden">Decision</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, SHOWN).map((g) => (
                <tr key={g.key}>
                  <td>
                    <div className="adm-name">{g.kind === "prefix" ? `${titleCase(g.key)} …` : g.name}</div>
                    <div className="adm-meta">
                      {g.kind === "prefix"
                        ? `Unbranded places starting with “${g.key}”, a chain you already block`
                        : g.kind === "brand"
                          ? `Brand ID ${g.key}`
                          : "Same name, no brand ID"}
                    </div>
                  </td>
                  <td className="adm-meta" style={{ marginTop: 0 }}>
                    {/* One country: the Places column already has the number. */}
                    {g.countries.length === 1
                      ? g.countries[0].code
                      : g.countries.slice(0, 4).map((c) => `${c.code} ${c.count}`).join(" · ") + (g.countries.length > 4 ? ` · +${g.countries.length - 4}` : "")}
                  </td>
                  <td className="num">{g.total.toLocaleString("en-US")}</td>
                  <td>
                    <div className="adm-actions">
                      <form action={decideSuggestionAction}>
                        <input type="hidden" name="key" value={g.key} />
                        <input type="hidden" name="name" value={g.name} />
                        <input type="hidden" name="kind" value={g.kind} />
                        <input type="hidden" name="decision" value="block" />
                        <button type="submit" className="btn btn-sm btn-ox" aria-label={`Block ${g.name}`}>
                          {g.kind === "prefix" ? "Block all" : "Block"}
                        </button>
                      </form>
                      <form action={decideSuggestionAction}>
                        <input type="hidden" name="key" value={g.key} />
                        <input type="hidden" name="name" value={g.name} />
                        <input type="hidden" name="kind" value={g.kind} />
                        <input type="hidden" name="decision" value="allow" />
                        <button type="submit" className="btn btn-sm btn-quiet" aria-label={`Allow ${g.name}`}>
                          Allow
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > SHOWN ? <p className="adm-meta" style={{ marginTop: 12 }}>Showing the {SHOWN} biggest of {rows.length}.</p> : null}
      </section>

      <aside>
        <div className="adm-panel">
          <h2 className="d4">Block a chain</h2>
          <p className="body-sm" style={{ color: "var(--ink-2)", marginTop: 6 }}>
            Looks the chain up in OpenStreetMap&apos;s brand list, so it&apos;s blocked in every country and language.
          </p>
          <form className="adm-row" style={{ marginTop: 12 }}>
            <input type="hidden" name="tab" value="chains" />
            <label htmlFor="chain-lookup" className="visually-hidden">Chain name</label>
            <input id="chain-lookup" name="chain" defaultValue={lookup} placeholder="e.g. Costa" required className="adm-input" />
            <button type="submit" className="btn btn-sm btn-line">Look up</button>
          </form>
          {lookup ? (
            <ul className="adm-chips" style={{ display: "grid", gap: 8 }}>
              {matches.map((m) => (
                <li key={m.wikidata}>
                  <form action={blockChainAction} className="adm-row">
                    <input type="hidden" name="chain" value={m.name} />
                    <input type="hidden" name="wikidata" value={m.wikidata} />
                    <input type="hidden" name="back" value="/admin/shops?tab=chains" />
                    <span className="body-sm" style={{ flex: 1 }}>
                      <strong>{m.label}</strong> · {m.where}
                    </span>
                    <button type="submit" className="btn btn-sm btn-ox">Block</button>
                  </form>
                </li>
              ))}
              {matches.length === 0 ? <li className="body-sm">Not in the brand list.</li> : null}
              <li>
                <form action={blockChainAction} className="adm-row">
                  <input type="hidden" name="chain" value={lookup} />
                  <input type="hidden" name="back" value="/admin/shops?tab=chains" />
                  <span className="body-sm" style={{ flex: 1 }}>By name only: “{normalizeChainName(lookup)}”</span>
                  <button type="submit" className="btn btn-sm btn-quiet">Block name</button>
                </form>
              </li>
            </ul>
          ) : null}
        </div>

        <div className="adm-panel">
          <h2 className="d4">
            Blocked <span className="adm-count quiet">{blocked.length}</span>
          </h2>
          <ul className="adm-chips">
            {blocked.map((c) => (
              <li key={c.name}>
                {/* Two-step: the chip only opens the confirm, so a stray click can't unblock a chain. */}
                <details>
                  <summary className="chip" title={c.wikidata ?? "name only"}>
                    {c.name}
                    {c.prefix ? " *" : ""}
                  </summary>
                  <form action={unblockChainAction} className="adm-row" style={{ marginTop: 6 }}>
                    <input type="hidden" name="chain" value={c.name} />
                    <button type="submit" className="btn btn-sm btn-quiet">Unblock</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
          <p className="adm-meta" style={{ marginTop: 12 }}>* also blocks names that start with it.</p>
        </div>

        {allowed.length ? (
          <div className="adm-panel">
            <h2 className="d4">
              Not chains <span className="adm-count quiet">{allowed.length}</span>
            </h2>
            <ul className="adm-chips">
              {allowed.map((c) => (
                <li key={c.name}>
                  <details>
                    <summary className="chip">{c.name}</summary>
                    <form action={unblockChainAction} className="adm-row" style={{ marginTop: 6 }}>
                      <input type="hidden" name="chain" value={c.name} />
                      <button type="submit" className="btn btn-sm btn-quiet">Forget</button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
