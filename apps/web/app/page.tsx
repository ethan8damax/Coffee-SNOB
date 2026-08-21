import Link from "next/link";
import { Eyebrow, Detour, DETOUR, DETOUR_SUB } from "@/components/primitives";
import { WebNav, LetterBand, WebFooter } from "@/components/web-chrome";
import { SignupForm } from "@/components/signup-form";

const US_CITIES = ["Portland", "Brooklyn", "Chicago", "Oakland", "Austin", "Seattle", "Los Angeles"];
const EU_CITIES = ["Lisbon", "Berlin", "Copenhagen", "Paris", "Milan", "Barcelona", "Rotterdam"];

const JOURNAL_TEASERS = [
  { kicker: "Roasters", title: "Nobody roasts for the second cup", dek: "Ana Beires roasts forty kilos a week in an Alcântara garage and is sold out by Thursday.", photoLabel: "Roaster at the drum, Alcântara garage" },
  { kicker: "Rooms", title: "The case for a bad chair", dek: "Four rooms we keep going back to, none of them comfortable.", photoLabel: "Wooden stool at a tiled counter" },
  { kicker: "Field notes", title: "Three days in Porto, one good espresso", dek: "A bar culture that resists everything specialty coffee wants from it.", photoLabel: "Porto café interior" },
];

const GUIDE_CITIES = [
  { city: "Lisbon", country: "Portugal", shops: 7, detour: 5, href: "/city-guides/lisbon" },
  { city: "Portland", country: "United States", shops: 0, detour: 0, href: undefined },
  { city: "Seattle", country: "United States", shops: 0, detour: 0, href: undefined },
  { city: "Austin", country: "United States", shops: 0, detour: 0, href: undefined },
];

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-type">
        <div className="hero-eyebrow">
          <span className="label">Pre-launch</span>
          <span className="hair" />
          <span className="label">Letter № 001 — Sunday</span>
        </div>
        <h1 className="h1">Find coffee<br />worth the <em>detour</em></h1>
        <div className="hero-sub">
          <p className="lede">A specialty coffee locator, in build. Until it ships we send one letter a week: one shop, one roaster, and the reason it earned the trip.</p>
          <SignupForm />
          <p className="fine">One a week. No round-ups, no affiliate padding. Unsubscribe whenever.</p>
        </div>
      </div>
      <div className="hero-art">
        <div className="photo-ph" data-label="Hero photograph — a counter, mid-service, shot from the customer side" />
      </div>
    </section>
  );
}

function CityBand() {
  const cities = [...US_CITIES.slice(0, 5), ...EU_CITIES.slice(0, 5)];
  return (
    <section className="cityband">
      <div className="cityband-in">
        <span className="label" style={{ color: "var(--oxblood)", flexShrink: 0 }}>Mapped at launch</span>
        <ul className="citylist">
          {cities.map((c) => (
            <li key={c}><Link href={c === "Lisbon" ? "/city-guides/lisbon" : "/city-guides"} className="d4">{c}</Link></li>
          ))}
          <li className="more"><Link href="/city-guides" className="d4">+ 22 more</Link></li>
        </ul>
      </div>
    </section>
  );
}

function Scale() {
  return (
    <section className="scale" style={{ background: "var(--oxblood)", color: "var(--cream)", padding: "104px 0 108px" }}>
      <div className="wrap">
        <div style={{ paddingBottom: 56 }}>
          <Eyebrow color="rgba(233,228,208,.5)">The rating</Eyebrow>
          <h2 className="h2">Five stars tell you<br />nothing. Ours tells<br />you whether to go.</h2>
          <p className="lede on-dark" style={{ marginTop: 18 }}>Every shop in Snob is rated on one question: how far would you travel for it? The scale is a sentence, not a number, and it is the only score we keep.</p>
        </div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid rgba(233,228,208,.18)" }}>
          {DETOUR.map((word, i) => (
            <li key={word} style={{ display: "grid", gridTemplateColumns: "52px 78px 300px 1fr", gap: 24, alignItems: "baseline", padding: "26px 0", borderBottom: "1px solid rgba(233,228,208,.18)" }}>
              <span className="num" style={{ fontSize: 15, color: i === 2 ? "var(--burnt)" : "rgba(233,228,208,.4)" }}>{i + 1}</span>
              <Detour value={i + 1} />
              <span className="d2" style={{ color: i === 2 ? "var(--burnt)" : "var(--cream)" }}>{word}</span>
              <span className="body" style={{ color: "rgba(233,228,208,.6)", maxWidth: "56ch" }}>{DETOUR_SUB[i]}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Guides() {
  return (
    <section className="guides" style={{ padding: "104px 0 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>City guides</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">One guide per city,<br />written on the ground.</h2>
            <Link href="/city-guides" className="seeall label-lg">All city guides →</Link>
          </div>
        </div>
        <div className="ggrid">
          {GUIDE_CITIES.map((c) => (
            <Link key={c.city} className="gcard" href={c.href ?? "/city-guides"}>
              <div className="photo-ph gphoto" data-label={`${c.city} — street or counter photograph`} />
              <div className="gline">
                <h3 className="d3">{c.city}</h3>
                <span className="label gcountry">{c.country}</span>
              </div>
              <div className="gmeta">
                <span className="body-sm">{c.shops ? <><span className="num">{c.shops}</span> shops</> : "Guide in progress"}</span>
                {c.detour > 0 && <span className="body-sm gbu"><span className="num">{c.detour}</span> worth the detour</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Journal() {
  return (
    <section className="journal" style={{ padding: "104px 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>The journal</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">What we are writing<br />while we build.</h2>
            <Link href="/journal" className="seeall label-lg">All writing →</Link>
          </div>
        </div>
        <div className="jgrid">
          {JOURNAL_TEASERS.map((a) => (
            <article key={a.title} className="jcard">
              <div className="photo-ph cr jphoto" data-label={a.photoLabel} />
              <span className="label jkicker">{a.kicker}</span>
              <h3 className="d3">{a.title}</h3>
              <p className="body">{a.dek}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Founder() {
  return (
    <section style={{ background: "var(--card)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", padding: "96px 56px" }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <Eyebrow color="var(--ink-3)">Why this exists</Eyebrow>
        <div style={{ marginTop: 32, display: "grid", gap: 20 }}>
          <p className="lede">Placeholder — rewrite this in your own voice. Two or three paragraphs on the trip that started it, the shop you still think about, and what was missing from every app you tried to plan it with.</p>
          <p className="body">Placeholder. Say who Snob is for and who it is not for. Being specific here is what makes people sign up.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 44, paddingTop: 28, borderTop: "1px solid var(--rule)" }}>
          <div className="photo-ph" style={{ width: 56, height: 56, borderRadius: "50%" }} data-label="Portrait" />
          <div>
            <div className="d4">Your name</div>
            <div className="label" style={{ color: "var(--ink-3)", marginTop: 6 }}>Founder, Coffee Snob</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="snob-web">
      <WebNav />
      <Hero />
      <CityBand />
      <Scale />
      <Guides />
      <Journal />
      <Founder />
      <LetterBand />
      <WebFooter />
    </div>
  );
}
