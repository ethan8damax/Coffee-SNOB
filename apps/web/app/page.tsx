import Link from "next/link";
import { Eyebrow, DETOUR, DETOUR_SUB } from "@/components/primitives";
import { WebNav, Doors, WebFooter } from "@/components/web-chrome";
import { SignupForm } from "@/components/signup-form";
import { getSupabase } from "@/lib/supabase";
import { getCitiesWithShopCounts } from "@coffeesnob/supabase";
import { APP_SIGN_UP_URL } from "@/lib/app-url";

export const revalidate = 60;

type CityWithShopCount = Awaited<ReturnType<typeof getCitiesWithShopCounts>>[number];

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-type">
        <div className="hero-eyebrow">
          <span className="label">Pre-launch</span>
        </div>
        <h1 className="h1">Find coffee<br />worth the <em>detour</em></h1>
        <div className="hero-sub">
          <p className="lede" data-reveal>Log what you drink. Rate it on the only scale that matters. Build a profile before the app even ships.</p>
          <Link href={APP_SIGN_UP_URL} className="btn btn-ox" data-reveal>Create your account</Link>
          <p className="fine" data-reveal>Free. Takes about a minute.</p>
        </div>
      </div>
      <div className="hero-art">
        <div className="photo-ph" data-label="Hero photograph — a counter, mid-service, shot from the customer side" />
      </div>
    </section>
  );
}

function CityBand({ cities }: { cities: CityWithShopCount[] }) {
  return (
    <section className="cityband">
      <div className="cityband-in">
        <span className="label" style={{ color: "var(--oxblood)", flexShrink: 0 }}>Mapped at launch</span>
        <ul className="citylist">
          {cities.map((c) => (
            <li key={c.slug}>
              {c.status === "live" || c.status === "demo"
                ? <Link href={`/city-guides/${c.slug}`} className="d4">{c.name}</Link>
                : <span className="d4">{c.name}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Scale() {
  return (
    <section className="scale" style={{ background: "var(--oxblood)", color: "var(--cream)", padding: "clamp(56px,12vw,104px) 0 clamp(56px,12vw,108px)" }}>
      <div className="wrap">
        <div className="scale-head">
          <div>
            <Eyebrow color="rgba(233,228,208,.5)">The rating</Eyebrow>
            <h2 className="h2" style={{ marginTop: 18 }}>Five stars tell you<br />nothing. Ours tells<br />you whether to go.</h2>
          </div>
          <p className="lede on-dark">Every shop in Snob is rated on one question: how far would you travel for it? The scale is a sentence, not a number, and it is the only score we keep.</p>
        </div>
        <ol className="scale-list">
          {DETOUR.map((word, i) => (
            <li key={word} className={"scale-row" + (i === 2 ? " is-active" : "")}>
              <span className="num scale-num">{i + 1}</span>
              <span className="scale-chevrons" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((n) => (
                  <svg key={n} width="10" height="13" viewBox="0 0 9 11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ "--fill-opacity": n <= i ? 1 : 0.3 } as React.CSSProperties}>
                    <path d="M1.5 1.5 6 5.5l-4.5 4" />
                  </svg>
                ))}
              </span>
              <span className="d2 scale-title">{word}</span>
              <span className="body scale-desc">{DETOUR_SUB[i]}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Guides({ cities }: { cities: CityWithShopCount[] }) {
  const featured = cities.slice(0, 4);
  return (
    <section className="guides" style={{ padding: "clamp(56px,12vw,104px) 0 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>City guides</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">One guide per city,<br />written on the ground.</h2>
            <Link href="/city-guides" className="seeall label-lg">All city guides →</Link>
          </div>
        </div>
        <div className="ggrid">
          {featured.map((c) => {
            const href = c.status === "live" || c.status === "demo" ? `/city-guides/${c.slug}` : "/city-guides";
            return (
              <Link key={c.slug} className="gcard" href={href}>
                <div className="photo-ph gphoto" data-label={`${c.name} — street or counter photograph`} />
                <div className="gline">
                  <h3 className="d3">{c.name}</h3>
                  <span className="label gcountry">{c.country}</span>
                </div>
                <div className="gmeta">
                  <span className="body-sm">{c.shopCount > 0 ? <><span className="num">{c.shopCount}</span> shops</> : "Guide in progress"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GetTheApp() {
  return (
    <section id="get-the-app" className="band-fade" style={{ color: "var(--cream)", padding: "96px 0 100px" }}>
      <div className="wrap letter-in">
        <div data-reveal>
          <Eyebrow color="rgba(233,228,208,.5)">The app</Eyebrow>
          <h2 className="h2" style={{ marginTop: 18 }}>Built for<br />wherever you land.</h2>
        </div>
        <div style={{ display: "grid", gap: 26 }}>
          <p className="lede on-dark" data-reveal>Streaks, saved lists, and a push alert the moment we map a new city — that experience is native-only. Join the list and you&rsquo;ll be first to know when it&rsquo;s ready.</p>
          <SignupForm dark cta="Join the waitlist" done={["You're on the list", "We'll email you the moment the app is ready to install."]} />
        </div>
      </div>
    </section>
  );
}

// A "Why this exists" founder section belongs here once there's a real
// story to tell — see docs/superpowers/specs/2026-08-26-marketing-site-truthful-launch-design.md.
// Structure to follow (from the deleted draft): (1) the trip/shop that
// started it, (2) who Snob is for and isn't, (3) a real name and photo.
// Don't ship placeholder narrative that reads as true.

export default async function LandingPage() {
  const supabase = getSupabase();
  const cities = await getCitiesWithShopCounts(supabase);

  return (
    <div className="snob-web">
      <WebNav />
      <main>
        <Hero />
        <CityBand cities={cities} />
        <Scale />
        <Guides cities={cities} />
        <GetTheApp />
      </main>
      <Doors />
      <WebFooter />
    </div>
  );
}
