"use client";

import { useState } from "react";
import Link from "next/link";
import { Script, Eyebrow } from "./primitives";

const NAV_ITEMS: [string, string][] = [
  ["City guides", "/city-guides"],
  ["Journal", "/journal"],
  ["Shop", "#"],
  ["The app", "#"],
  ["About", "#"],
];

export function WebNav({ active }: { active?: string }) {
  return (
    <header className="nav">
      <Link href="/" className="nav-logo"><Script height={30} /></Link>
      <nav className="nav-links">
        {NAV_ITEMS.map(([label, href]) => (
          <Link key={label} href={href} className={active === label ? "on" : undefined}>{label}</Link>
        ))}
      </nav>
      <div className="nav-right">
        <a href="#" className="nav-sign">Sign in</a>
        <a href="#letter" className="btn btn-bu nav-cta">Get the letter</a>
      </div>
    </header>
  );
}

export function SignupForm({
  dark = false, placeholder = "you@email.com", cta = "Get the letter", done,
}: { dark?: boolean; placeholder?: string; cta?: string; done?: [string, string] }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className={`signed ${dark ? "on-dark" : ""}`}>
        <span className="label-lg">{done ? done[0] : "You're on the list"}</span>
        <p className="body">{done ? done[1] : "First letter lands Sunday. Nothing else until then."}</p>
      </div>
    );
  }

  return (
    <form className={`signup ${dark ? "on-dark" : ""}`} onSubmit={(e) => { e.preventDefault(); if (email.trim()) setSent(true); }}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} aria-label="Email address" />
      <button type="submit" className="btn btn-bu">{cta}</button>
    </form>
  );
}

export function LetterBand() {
  return (
    <section className="letter" id="letter">
      <div className="wrap letter-in">
        <div>
          <Eyebrow color="rgba(240,236,223,.55)">The Sunday letter</Eyebrow>
          <h2 className="h2 letter-h">One shop.<br />One roaster.<br />Nothing else.</h2>
        </div>
        <div className="letter-form">
          <p className="lede">Sent every Sunday morning. A shop worth the detour, the roaster behind the bar, and where we are opening the map next.</p>
          <SignupForm dark />
          <ul className="letter-meta">
            <li className="body-sm">Free, and it stays free</li>
            <li className="body-sm">No sponsored placements</li>
            <li className="body-sm">Early access when the app ships</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function WebFooter() {
  const cols: [string, [string, string][]][] = [
    ["Discover", [["City guides", "/city-guides"], ["The map", "#"], ["Collections", "#"], ["Submit a shop", "#"]]],
    ["Read", [["Journal", "/journal"], ["Roaster interviews", "/journal"], ["Brewing", "/journal"], ["The year in coffee", "#"]]],
    ["Shop", [["Snob merch", "#"], ["Gear we use", "#"], ["Bean subscription", "#"], ["Gift the letter", "#"]]],
    ["Snob", [["About", "#"], ["The detour scale", "#"], ["The app", "#"], ["Press", "#"], ["Contact", "#"]]],
  ];
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <div className="foot-brand">
          <Script height={34} color="var(--cream)" />
          <p className="body-sm">A specialty coffee locator. In build, from wherever the coffee is good.</p>
        </div>
        {cols.map(([heading, links]) => (
          <div key={heading} className="foot-col">
            <span className="label">{heading}</span>
            <ul>{links.map(([label, href]) => <li key={label}><Link href={href}>{label}</Link></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="wrap foot-base">
        <span className="body-sm">© 2026 Coffee Snob</span>
        <div className="foot-legal">
          <a href="#" className="body-sm">Privacy</a>
          <a href="#" className="body-sm">Terms</a>
        </div>
      </div>
    </footer>
  );
}
