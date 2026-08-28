"use client";

import { useState } from "react";
import Link from "next/link";

export function MobileNav({ items, active }: { items: [string, string][]; active?: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span /><span /><span />
      </button>
      <div id="mobile-nav-drawer" className={`nav-drawer${open ? " is-open" : ""}`}>
        <nav className="nav-drawer-links">
          {items.map(([label, href]) => (
            <Link key={label} href={href} className={active === label ? "on" : undefined} aria-current={active === label ? "page" : undefined} onClick={close}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="nav-drawer-actions">
          <a href="#letter" className="btn btn-bu nav-cta" onClick={close}>Get the letter</a>
        </div>
      </div>
    </>
  );
}
