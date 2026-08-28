"use client";

import { useState } from "react";

export function SignupForm({
  dark = false, placeholder = "you@email.com", cta = "Sign up", done,
}: { dark?: boolean; placeholder?: string; cta?: string; done?: [string, string] }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  if (status === "sent") {
    return (
      <div className={`signed ${dark ? "on-dark" : ""}`} aria-live="polite">
        <span className="label-lg">{done ? done[0] : "You're on the list"}</span>
        <p className="body">{done ? done[1] : "We'll be in touch."}</p>
      </div>
    );
  }

  return (
    <form
      className={`signup ${dark ? "on-dark" : ""}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!email.trim() || status === "loading") return;
        setStatus("loading");
        try {
          const res = await fetch("/api/newsletter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim() }),
          });
          setStatus(res.ok ? "sent" : "error");
        } catch {
          setStatus("error");
        }
      }}
    >
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder} aria-label="Email address" disabled={status === "loading"}
      />
      <button type="submit" className="btn btn-bu" disabled={status === "loading"}>
        {status === "loading" ? "Sending…" : cta}
      </button>
      {status === "error" && <p className="body-sm" role="alert">Something went wrong — try again in a minute.</p>}
    </form>
  );
}
