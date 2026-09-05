import Link from "next/link";
import { Script, Eyebrow } from "./primitives";
import { MobileNav } from "./mobile-nav";
import { APP_SIGN_UP_URL, APP_SIGN_IN_URL, APP_MAP_URL } from "@/lib/app-url";

const NAV_ITEMS: [string, string][] = [
  ["City guides", "/city-guides"],
  ["Journal", "/journal"],
];

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
        <Link href={APP_SIGN_UP_URL} className="btn" style={{ background: "var(--cream)", color: "var(--ink)", marginTop: 14 }}>Create your account</Link>
      </div>
      <div className="door">
        <span className="label">Coming to your phone</span>
        <h3 className="d3">Get the app</h3>
        <Link href="/#get-the-app" className="btn btn-line" style={{ marginTop: 14 }}>Join the waitlist</Link>
      </div>
      <div className="door cr">
        <span className="label">No account needed</span>
        <h3 className="d3">Browse the guides</h3>
        <Link href="/city-guides" className="btn btn-line" style={{ marginTop: 14 }}>City guides →</Link>
      </div>
    </section>
  );
}

export function WebFooter() {
  const cols: [string, [string, string][]][] = [
    ["Discover", [["City guides", "/city-guides"]]],
    ["Read", [["Journal", "/journal"]]],
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
        <span className="body-sm">© {new Date().getFullYear()} Coffee Snob</span>
      </div>
    </footer>
  );
}
