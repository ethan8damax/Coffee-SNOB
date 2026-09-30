import Link from "next/link";
import type { Message, MessageKind } from "@coffeesnob/supabase";
import { decideMessageAction } from "./actions";
import { Flash } from "./added-tab";

// Tell us (0037): bugs, ideas, and notes. Opening one marks it Seen for the
// sender; Done and Pass tell them at the top of their feed. Replies go by email.

export const MESSAGE_BOX: Record<MessageKind, { title: string; empty: string; noun: string }> = {
  bug: { title: "Bugs", empty: "No bugs waiting. People send them from Settings → Report a bug.", noun: "bug" },
  idea: { title: "Ideas", empty: "No ideas waiting. People send them from Settings → Suggest something.", noun: "idea" },
  contact: { title: "Messages", empty: "No messages waiting. People write from Settings → Contact us.", noun: "note" },
};

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};
const firstLine = (s: string) => {
  const line = s.trim().split("\n")[0];
  return line.length > 90 ? `${line.slice(0, 89)}…` : line;
};
const who = (m: Message) => (m.sender ? `@${m.sender}` : "someone");
const STATUS: Record<Message["status"], string> = { sent: "New", seen: "Seen", done: "Done", passed: "Passed" };

export function MessagesTab({
  kind,
  open,
  decided,
  current,
  email,
  flash,
}: {
  kind: MessageKind;
  open: Message[];
  decided: Message[];
  current: Message | null;
  email: string | null;
  flash: { done?: string; error?: string };
}) {
  const box = MESSAGE_BOX[kind];
  const href = (id?: string) => `/admin/shops?tab=inbox&box=${kind}${id ? `&msg=${id}` : ""}`;
  return (
    <div className="adm-grid">
      <section className="adm-section" aria-labelledby="msg-h">
        <h2 id="msg-h" className="d3">{box.title}</h2>
        <p className="body">Oldest first. The sender sees New, Seen, Done or Passed. Anything you write in a decision, they read.</p>
        <Flash {...flash} />

        {current ? <Open m={current} email={email} close={href()} /> : null}

        {open.length === 0 ? (
          <div className="adm-empty">
            <p className="body">{box.empty}</p>
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">{box.title.replace(/s$/, "")}</th>
                <th scope="col">From</th>
                <th scope="col"><span className="visually-hidden">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {open.map((m) => (
                <tr key={m.id} aria-current={current?.id === m.id ? "true" : undefined} style={current?.id === m.id ? { background: "var(--card)" } : undefined}>
                  <td>
                    <div className="adm-name" style={{ fontWeight: m.status === "sent" ? 700 : 400 }}>{firstLine(m.body)}</div>
                    <div className="adm-meta">{m.context.screen ? `From ${m.context.screen}` : null}</div>
                  </td>
                  <td>
                    {who(m)}
                    <div className="adm-meta">
                      {ago(m.createdAt)} · {STATUS[m.status]}
                    </div>
                  </td>
                  <td>
                    <div className="adm-actions">
                      <Link href={href(m.id)} className="btn btn-sm btn-line" aria-label={`Open ${box.noun} from ${who(m)}`}>
                        Open
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
          <h2 className="d4">
            Decided <span className="adm-count quiet">{decided.length}</span>
          </h2>
          {decided.length === 0 ? (
            <p className="body-sm" style={{ color: "var(--ink-2)", marginTop: 8 }}>Nothing yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
              {decided.map((m) => (
                <li key={m.id} className="body-sm">
                  <strong>{firstLine(m.body)}</strong>{" "}
                  <span className={`chip ${m.status === "done" ? "on" : ""}`} style={{ marginLeft: 6 }}>{STATUS[m.status]}</span>
                  <span className="adm-meta" style={{ display: "block" }}>
                    {who(m)}
                    {m.reason ? ` · “${m.reason}”` : ""}
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

function Open({ m, email, close }: { m: Message; email: string | null; close: string }) {
  const kind = MESSAGE_BOX[m.kind];
  const quoted = m.body
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Your ${kind.noun} to Coffee Snob`)}&body=${encodeURIComponent(`\n\n${quoted}`)}`
    : null;
  const context = [
    ["Screen", m.context.screen],
    ["Platform", m.context.platform],
    ["App", m.context.version],
    ["Window", m.context.viewport],
    ["Browser", m.context.agent],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <div className="adm-panel" style={{ marginTop: 20 }}>
      <div className="adm-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 className="d4">
          A {kind.noun} from {who(m)}
        </h3>
        <Link href={close} className="label">Close</Link>
      </div>
      <p className="adm-meta">
        {ago(m.createdAt)} · {STATUS[m.status]}
        {email ? ` · ${email}` : ""}
      </p>
      <p className="body" style={{ whiteSpace: "pre-wrap", margin: "14px 0 0" }}>{m.body}</p>
      {context.length ? (
        <dl className="body-sm" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", margin: "14px 0 0", color: "var(--ink-2)" }}>
          {context.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt className="label">{k}</dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="adm-row" style={{ flexWrap: "wrap", gap: 8, marginTop: 18 }}>
        {mailto ? (
          <a href={mailto} className="btn btn-sm btn-line">
            Reply by email
          </a>
        ) : null}
      </div>

      <form action={decideMessageAction} style={{ display: "grid", gap: 8, marginTop: 18 }}>
        <input type="hidden" name="id" value={m.id} />
        <input type="hidden" name="box" value={m.kind} />
        <label htmlFor="msg-reason" className="label">
          A line for them (optional, they&apos;ll see it)
        </label>
        <input id="msg-reason" name="reason" maxLength={300} className="adm-input" placeholder={m.kind === "bug" ? "Fixed in today's update." : "Thanks. It's on the list."} />
        <div className="adm-row" style={{ gap: 8 }}>
          <button type="submit" name="outcome" value="done" className="btn btn-sm btn-ox">
            {m.kind === "bug" ? "Fixed" : "Done"}
          </button>
          <button type="submit" name="outcome" value="passed" className="btn btn-sm btn-quiet">
            Pass
          </button>
        </div>
      </form>
    </div>
  );
}
