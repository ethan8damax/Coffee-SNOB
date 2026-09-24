import { Eyebrow, Script, DETOUR, DETOUR_SUB } from "@/components/primitives";
import { WebNav, WebFooter } from "@/components/web-chrome";
import { AppTour } from "@/components/app-tour";
import { APP_MAP_URL, APP_SIGN_UP_URL } from "@/lib/app-url";

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-type">
        <div className="hero-eyebrow">
          <span className="label">Open on the web</span>
          <span className="hair" />
          <span className="label">No download</span>
        </div>
        <h1 className="h1">Find coffee<br />worth the <em>detour</em></h1>
        <div className="hero-sub">
          <p className="lede" data-reveal>Every café near you on one map. Log what you drink, rate it on the only scale that matters, and keep the record on your profile.</p>
          <div className="cta-row" data-reveal>
            <a href={APP_MAP_URL} className="btn btn-bu">Open the map</a>
            <a href={APP_SIGN_UP_URL} className="btn btn-line">Create your account</a>
          </div>
          <p className="fine" data-reveal>Free. Browse without an account; sign up to log.</p>
        </div>
      </div>
      <div className="hero-art">
        <div className="photo-ph" data-label="Hero photograph — a counter, mid-service, shot from the customer side" />
        <div className="hero-art-tag"><Script height={40} color="var(--cream)" /></div>
      </div>
    </section>
  );
}

function Scale() {
  return (
    <section className="scale">
      <div className="wrap">
        <div className="scale-head">
          <div>
            <Eyebrow color="rgba(233,228,208,.5)">The rating</Eyebrow>
            <h2 className="h2">How far would you go?</h2>
          </div>
        </div>
        <ol className="scale-list">
          {DETOUR.map((word, i) => (
            <li key={word} className={"scale-row" + (i === 2 ? " is-active" : "")}>
              <span className="num scale-num">{i + 1}</span>
              <span className="scale-chevrons" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((n) => (
                  <svg key={n} width="11" height="14" viewBox="0 0 9 11" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ "--fill-opacity": n <= i ? 1 : 0.22 } as React.CSSProperties}>
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

function AppSection() {
  return (
    <section className="app">
      <div className="wrap">
        <Eyebrow color="var(--oxblood)">The app</Eyebrow>
        <AppTour head={<h2 className="h2 ox">A map, a logbook,<br />and a record of<br />where you&rsquo;ve been.</h2>}>
          <a href={APP_MAP_URL} className="btn btn-ox">Open the map</a>
          <p className="fine ox-fine">Runs in your browser on any phone or laptop. Add it to your home screen and it opens like an app.</p>
        </AppTour>
      </div>
    </section>
  );
}

function Start() {
  return (
    <section className="letter">
      <div className="wrap letter-in">
        <div>
          <Eyebrow color="rgba(22,19,16,.55)">Start here</Eyebrow>
          <h2 className="h2 letter-h">Open the map.<br />Find one worth<br />the detour.</h2>
        </div>
        <div className="letter-form">
          <p className="lede">Browse the map without an account. When you&rsquo;ve had the cup, make one and log it. It takes about a minute.</p>
          <div className="cta-row">
            <a href={APP_MAP_URL} className="btn btn-ox">Open the map</a>
            <a href={APP_SIGN_UP_URL} className="btn btn-line">Create your account</a>
          </div>
          <ul className="letter-meta">
            <li className="body-sm">Free</li>
            <li className="body-sm">No sponsored placements</li>
            <li className="body-sm">Nothing to install</li>
          </ul>
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

export default function LandingPage() {
  return (
    <div className="snob-web">
      <WebNav />
      <main>
        <Hero />
        <Scale />
        <AppSection />
        <Start />
      </main>
      <WebFooter />
    </div>
  );
}
