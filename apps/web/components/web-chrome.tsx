import Link from "next/link";
import { Script, Eyebrow } from "./primitives";
import { MobileNav } from "./mobile-nav";
import { APP_SIGN_UP_URL, APP_SIGN_IN_URL, APP_MAP_URL } from "@/lib/app-url";

// ponytail: City guides and Journal are hidden for v1 (not developed yet);
// their pages still exist. Re-add ["City guides", "/city-guides"] and
// ["Journal", "/journal"] here and in WebFooter when they're ready.
const NAV_ITEMS: [string, string][] = [];

export function WebNav({ active }: { active?: string }) {
  return (
    <header className="nav">
      <Link href="/" className="nav-logo"><Script height={30} /></Link>
      <nav className="nav-links">
        {NAV_ITEMS.map(([label, href]) => (
          <Link key={label} href={href} className={active === label ? "on" : undefined} aria-current={active === label ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <div className="nav-right">
        <a href={APP_SIGN_IN_URL} className="nav-sign">Sign in</a>
        <a href={APP_MAP_URL} className="btn btn-bu nav-cta">See what&apos;s near you</a>
      </div>
      <MobileNav items={NAV_ITEMS} active={active} signInHref={APP_SIGN_IN_URL} mapHref={APP_MAP_URL} />
    </header>
  );
}

export function Doors() {
  return (
    <section className="doors">
      <div className="door ox">
        <span className="label">Do this now</span>
        <h3 className="d3">Log what you drink</h3>
        <a href={APP_SIGN_UP_URL} className="btn" style={{ background: "var(--cream)", color: "var(--ink)", marginTop: 14 }}>Create your account</a>
      </div>
      <div className="door">
        <span className="label">No account needed</span>
        <h3 className="d3">See what&apos;s near you</h3>
        <a href={APP_MAP_URL} className="btn btn-line" style={{ marginTop: 14 }}>Open the map</a>
      </div>
      <div className="door cr">
        <span className="label">Read first</span>
        <h3 className="d3">Browse the guides</h3>
        <Link href="/city-guides" className="btn btn-line" style={{ marginTop: 14 }}>City guides →</Link>
      </div>
    </section>
  );
}

export function WebFooter() {
  const cols: [string, [string, string][]][] = [
    ["The app", [["The map", APP_MAP_URL], ["Create an account", APP_SIGN_UP_URL], ["Sign in", APP_SIGN_IN_URL]]],
  ];
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <div className="foot-brand">
          <Script height={34} color="var(--cream)" />
          <p className="body-sm">A specialty coffee locator, from wherever the coffee is good.</p>
        </div>
        {cols.map(([heading, links]) => (
          <div key={heading} className="foot-col">
            <span className="label">{heading}</span>
            <ul>{links.map(([label, href]) => <li key={label}><Link href={href}>{label}</Link></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="wrap foot-base">
        <span className="body-sm">© {new Date().getFullYear()} Coffee Snob</span>
      </div>
    </footer>
  );
}
