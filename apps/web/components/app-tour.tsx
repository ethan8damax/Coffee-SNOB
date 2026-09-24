"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// A scripted, looping walkthrough of the v1 web app, drawn in HTML (not
// screenshots) — pattern borrowed from Parish's MobileAppTour. Everything
// inside the phone is authored at 390×844 design px and scaled by CSS
// (--tour-s in globals.css). All shops and people here are invented.

type Scene = "map" | "log" | "profile";
type Step = { scene: Scene; ms: number; target?: string; tap?: boolean };

const STEPS: Step[] = [
  { scene: "map", ms: 1500 },
  { scene: "map", ms: 700, target: "pin" },
  { scene: "map", ms: 1700, target: "pin", tap: true },
  { scene: "map", ms: 700, target: "log-btn" },
  { scene: "log", ms: 1100, tap: true },
  { scene: "log", ms: 700, target: "verdict" },
  { scene: "log", ms: 900, target: "verdict", tap: true },
  { scene: "log", ms: 600, target: "drink" },
  { scene: "log", ms: 2100, target: "drink", tap: true },
  { scene: "log", ms: 700, target: "publish" },
  { scene: "profile", ms: 4600, tap: true },
];
const SCENE_START: Record<Scene, number> = { map: 0, log: 4, profile: 10 };
// Reduced motion: no loop, each tab shows one finished frame instead.
const STILL: Record<Scene, number> = { map: 2, log: 8, profile: 10 };

const TABS: [Scene, string, string][] = [
  ["map", "The map", "Every café near you. The ones people have logged carry their verdict right on the pin."],
  ["log", "Your log", "One entry per visit: the verdict, what you drank, and a note only you have to understand."],
  ["profile", "Your profile", "Every visit you've logged, your faves, the shops you've saved, and the people whose taste you trust."],
];

const NOTE = "Pulled short and syrupy. The cortado alone is worth the drive.";

export function AppTour({ head, children }: { head: ReactNode; children?: ReactNode }) {
  const [step, setStep] = useState(0);
  const [animated, setAnimated] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnimated(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const node = rootRef.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!animated || !inView) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEPS[step].ms);
    return () => clearTimeout(t);
  }, [step, animated, inView]);

  const scene = STEPS[step].scene;
  return (
    <div className="tour">
      <div className="tour-copy">
      {head}
      <div className="tour-tabs" role="group" aria-label="What's in the app">
        {TABS.map(([id, title, desc]) => (
          <button key={id} type="button" className={"tour-tab" + (scene === id ? " on" : "")} aria-pressed={scene === id}
            onClick={() => setStep((animated ? SCENE_START : STILL)[id])}>
            <span className="d4">{title}</span>
            <span className="body">{desc}</span>
          </button>
        ))}
      </div>
      <div className="tour-cta">{children}</div>
      </div>
      <div className="tour-phone" ref={rootRef} aria-hidden="true">
        <Phone step={animated || step ? step : STILL.map} animated={animated} />
      </div>
    </div>
  );
}

function Phone({ step, animated }: { step: number; animated: boolean }) {
  const { scene, target, tap } = STEPS[step];
  const screenRef = useRef<HTMLDivElement>(null);
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null);

  // Finger position comes from the target's real rect, converted back to design px.
  useLayoutEffect(() => {
    const screen = screenRef.current;
    const el = target && screen?.querySelector<HTMLElement>(`[data-tap="${target}"]`);
    if (!screen || !el) return setFinger(null);
    const s = screen.getBoundingClientRect(), r = el.getBoundingClientRect();
    const k = s.width / 390;
    setFinger({ x: (r.left - s.left + r.width / 2) / k, y: (r.top - s.top + r.height / 2) / k });
  }, [target, scene]);

  return (
    <div className="device">
      <div className="t-screen" ref={screenRef}>
        <StatusBar dark={false} />
        {scene === "map" && <MapScene cardOpen={step >= 2} />}
        {scene === "log" && <LogScene verdict={step >= 6} drink={step >= 8} typing={step >= 8} instant={!animated} />}
        {scene === "profile" && <ProfileScene />}
        <TabBar active={scene === "profile" ? "You" : scene === "map" ? "Map" : ""} />
        {finger && animated && <span key={step} className={"t-finger" + (tap ? " tap" : "")} style={{ left: finger.x, top: finger.y }} />}
      </div>
    </div>
  );
}

function Chevrons({ n, color = "var(--burnt)", w = 5 }: { n: number; color?: string; w?: number }) {
  return (
    <span className="t-chev">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={w} height={w * 1.27} viewBox="0 0 9 11" fill="none" stroke={color} strokeOpacity={i <= n ? 1 : 0.3} strokeWidth="2.8">
          <path d="M1.5 1.5 6 5.5l-4.5 4" />
        </svg>
      ))}
    </span>
  );
}

function StatusBar({ dark }: { dark: boolean }) {
  return (
    <div className="t-status" style={{ color: dark ? "var(--cream)" : "var(--ink)" }}>
      <span>9:41</span>
      <span className="t-status-r"><i /><i /><i /><b /></span>
    </div>
  );
}

function TabBar({ active }: { active: string }) {
  return (
    <div className="t-tabbar">
      {["Feed", "Map", "You"].map((t) => (
        <span key={t} className={"label" + (t === "Map" ? " t-mappill" : "") + (active === t && t !== "Map" ? " on" : "")}>{t}</span>
      ))}
    </div>
  );
}

// ── Map ──
const RATED = [
  { x: 92, y: 250, n: 5, name: "Low Ceiling" },
  { x: 278, y: 330, n: 4, name: "Field Day" },
  { x: 150, y: 400, n: 3 },
  { x: 312, y: 540, n: 4, name: "Kiln" },
  { x: 70, y: 520, n: 2 },
];
const DOTS = [[200, 210], [330, 250], [120, 330], [60, 420], [190, 520], [260, 610], [100, 640], [340, 430]];

function MapScene({ cardOpen }: { cardOpen: boolean }) {
  return (
    <>
      <svg className="t-basemap" viewBox="0 0 390 844" preserveAspectRatio="none">
        <rect width="390" height="844" fill="#ebe5d4" />
        <path d="M0 470 C120 450 210 500 390 460 L390 530 C230 560 120 520 0 540Z" fill="#b6c9ca" opacity=".55" />
        <rect x="170" y="260" width="90" height="70" fill="#c9d5c2" />
        <g stroke="#faf8ef" strokeWidth="9" fill="none">
          <path d="M-10 300 L400 360" /><path d="M140 -10 L110 860" /><path d="M-10 620 L400 580" /><path d="M300 -10 L250 860" />
        </g>
        <g stroke="#faf8ef" strokeWidth="4" fill="none">
          <path d="M-10 180 L400 200" /><path d="M40 -10 L20 860" /><path d="M210 -10 L200 860" /><path d="M-10 720 L400 700" /><path d="M360 -10 L350 860" />
        </g>
      </svg>
      <div className="t-mapbar">
        <div className="t-search"><span className="body">Search a city or a shop</span></div>
        <div className="t-chips">
          <span className="chip on">All</span><span className="chip">Rated</span><span className="chip">Make the trip +</span>
        </div>
      </div>
      {DOTS.map(([x, y], i) => <span key={i} className="t-dot" style={{ left: x, top: y, ["--i" as string]: i }} />)}
      {RATED.map((p, i) => {
        const bg = p.n === 5 ? "var(--oxblood)" : p.n === 4 ? "var(--burnt)" : "var(--card)";
        const fg = p.n === 5 ? "var(--cream)" : p.n === 4 ? "var(--ink)" : "var(--ink-2)";
        return (
          <span key={i} className="t-pin" style={{ left: p.x, top: p.y, ["--i" as string]: i + 3 }}>
            <span className="t-pin-tag" style={{ background: bg, borderColor: p.n >= 4 ? bg : "rgba(22,19,16,.32)" }}>
              {p.name && <span className="t-pin-name" style={{ color: fg }}>{p.name}</span>}
              <Chevrons n={p.n} color={fg} w={p.name ? 5 : 4.5} />
            </span>
            <span className="t-pin-stem" style={{ background: p.n >= 4 ? bg : "rgba(22,19,16,.32)" }} />
          </span>
        );
      })}
      <span className={"t-dot sel" + (cardOpen ? " on" : "")} data-tap="pin" style={{ left: 232, top: 452 }} />
      <span className="t-me" style={{ left: 180, top: 470 }} />
      <div className={"t-card" + (cardOpen ? " open" : "")}>
        <div className="t-card-head"><span className="d4">Hollow Pine Coffee</span><span className="label">Not yet rated</span></div>
        <span className="label t-card-addr">Edgewood Ave</span>
        <div className="t-card-actions">
          <span className="t-btn ox" data-tap="log-btn">+ Log a visit</span>
          <span className="t-btn line">Directions</span>
        </div>
      </div>
    </>
  );
}

// ── Log ──
const VERDICTS: [string, string][] = [
  ["Stay home", "Not worth leaving the house for."],
  ["If it's on your way", "Fine if you're already nearby."],
  ["Worth the detour", "Go a little out of your way."],
  ["Make the trip", "Plan part of your day around it."],
  ["Catch a flight", "Book the ticket. It's that good."],
];
const DRINKS = ["Espresso", "Cortado", "Flat white", "V60", "Batch"];

function LogScene({ verdict, drink, typing, instant }: { verdict: boolean; drink: boolean; typing: boolean; instant: boolean }) {
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (!typing) return setTyped(0);
    if (instant) return setTyped(NOTE.length);
    const t = setInterval(() => setTyped((n) => (n >= NOTE.length ? n : n + 2)), 28);
    return () => clearInterval(t);
  }, [typing, instant]);
  return (
    <div className="t-log t-in">
      <div className="t-log-head">
        <span className="label" style={{ color: "var(--ink-2)" }}>Cancel</span>
        <span className="label">New entry</span>
        <span className="label" data-tap="publish" style={{ color: verdict ? "var(--burnt)" : "var(--ink-3)" }}>Publish</span>
      </div>
      <span className="label">Logging</span>
      <div className="d2" style={{ marginTop: 6 }}>Hollow Pine Coffee</div>
      <span className="label t-sec">How far would you go?</span>
      <div className="t-verdicts">
        {VERDICTS.map(([word, sub], i) => {
          const on = verdict && i === 3;
          return (
            <div key={word} className={"t-verdict" + (on ? " on" : "")} data-tap={i === 3 ? "verdict" : undefined}>
              <Chevrons n={i + 1} color={on ? "var(--ink)" : "var(--burnt)"} w={7} />
              <span className="t-verdict-word">{word}</span>
              <span className="t-verdict-sub">{sub}</span>
            </div>
          );
        })}
      </div>
      <span className="label t-sec">What you ordered</span>
      <div className="t-drinks">
        {DRINKS.map((d) => <span key={d} className={"chip" + (drink && d === "Cortado" ? " on" : "")} data-tap={d === "Cortado" ? "drink" : undefined}>{d}</span>)}
      </div>
      <span className="label t-sec">Your note</span>
      <div className="t-note">{typed ? NOTE.slice(0, typed) : <span style={{ color: "var(--ink-3)" }}>What earned it, or lost it? Be specific.</span>}</div>
    </div>
  );
}

// ── Profile ──
// Deterministic 12-week heatmap (no Math.random — keeps SSR and client identical).
const HEAT = Array.from({ length: 84 }, (_, i) => [0, 1, 0, 2, 0, 0, 1, 3, 0, 1, 2, 0, 0][(i * 7 + (i >> 3)) % 13]);
const HEAT_COLOR = ["var(--rule-2)", "var(--sage)", "var(--burnt)", "var(--oxblood)"];
const ENTRIES: [string, number, string][] = [
  ["Hollow Pine Coffee", 4, "Cortado"],
  ["Low Ceiling", 5, "V60"],
  ["Field Day", 4, "Flat white"],
  ["Corner Room", 2, "Batch"],
];

function ProfileScene() {
  return (
    <div className="t-profile t-in">
      <div className="t-prof-head">
        <div className="t-avatar">JH</div>
        <div>
          <div className="d2">Jordan Hale</div>
          <span className="label" style={{ color: "var(--ink-2)" }}>@jordanhale</span>
        </div>
      </div>
      <div className="t-stats">
        {[["24", "Entries"], ["41", "Followers"], ["36", "Following"]].map(([v, l]) => (
          <div key={l}><span className="num">{v}</span><span className="label">{l}</span></div>
        ))}
      </div>
      <div className="t-status-blk">
        <span className="label">Snob status</span>
        <div className="d4" style={{ margin: "6px 0 10px", color: "var(--oxblood)" }}>Connoisseur</div>
        <div className="t-heat">
          {HEAT.map((v, i) => <i key={i} style={{ background: HEAT_COLOR[i === 83 ? 2 : v], ["--i" as string]: i }} />)}
        </div>
      </div>
      <div className="t-ptabs"><span className="label on">Entries</span><span className="label">Faves</span><span className="label">Saved</span></div>
      {ENTRIES.map(([name, n, drink], i) => (
        <div key={name} className={"t-entry" + (i === 0 ? " new" : "")}>
          <div className="t-entry-ph" />
          <div>
            <div className="d4" style={{ fontSize: 15 }}>{name}</div>
            <span className="label" style={{ display: "block", margin: "5px 0 6px" }}>{drink}</span>
            <Chevrons n={n} w={5} />
          </div>
        </div>
      ))}
    </div>
  );
}
