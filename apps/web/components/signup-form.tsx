"use client";

import { useState } from "react";

// ponytail: local-state stub only, no real request — wire to a real signup endpoint before launch
export function SignupForm({
  dark = false, placeholder = "you@email.com", cta = "Get the letter", done,
}: { dark?: boolean; placeholder?: string; cta?: string; done?: [string, string] }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className={`signed ${dark ? "on-dark" : ""}`} aria-live="polite">
        <span className="label-lg">{done ? done[0] : "You're on the list"}</span>
        <p className="body">{done ? done[1] : "First letter lands Sunday. Nothing else until then."}</p>
      </div>
    );
  }

  return (
    <form className={`signup ${dark ? "on-dark" : ""}`} onSubmit={(e) => { e.preventDefault(); if (email.trim()) setSent(true); }}>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} aria-label="Email address" />
      <button type="submit" className="btn btn-bu">{cta}</button>
    </form>
  );
}
