import Link from "next/link";
import { Eyebrow, DETOUR, DETOUR_SUB } from "@/components/primitives";
import { WebNav, LetterBand, WebFooter } from "@/components/web-chrome";
import { SignupForm } from "@/components/signup-form";
import { getSupabase } from "@/lib/supabase";
import { getCitiesWithShopCounts } from "@coffeesnob/supabase";
import { getAllJournalPosts } from "@/lib/journal";

export const revalidate = 60;

type CityWithShopCount = Awaited<ReturnType<typeof getCitiesWithShopCounts>>[number];

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
                  <svg key={n} width="10" height="13" viewBox="0 0 9 11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity={n <= i ? 1 : 0.3}>
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

function Journal() {
  const posts = getAllJournalPosts().slice(0, 3);
  if (posts.length === 0) return null;
  return (
    <section className="journal" style={{ padding: "clamp(56px,12vw,104px) 0" }}>
      <div className="wrap">
        <div className="sec-head">
          <Eyebrow>The journal</Eyebrow>
          <div className="sec-head-row">
            <h2 className="h2">What we are writing<br />while we build.</h2>
            <Link href="/journal" className="seeall label-lg">All writing →</Link>
          </div>
        </div>
        <div className="jgrid">
          {posts.map((p) => (
            <Link key={p.slug} href={`/journal/${p.slug}`} className="jcard">
              <div className="photo-ph cr jphoto" data-label={p.frontmatter.photoAlt} />
              <span className="label jkicker">{p.frontmatter.category}</span>
              <h3 className="d3">{p.frontmatter.title}</h3>
              <p className="body">{p.frontmatter.dek}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Founder() {
  return (
    <section style={{ background: "var(--card)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", padding: "clamp(56px,12vw,96px) clamp(20px,7vw,56px)" }}>
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

export default async function LandingPage() {
  const supabase = getSupabase();
  const cities = await getCitiesWithShopCounts(supabase);

  return (
    <div className="snob-web">
      <WebNav />
      <Hero />
      <CityBand cities={cities} />
      <Scale />
      <Guides cities={cities} />
      <Journal />
      <LetterBand />
      <WebFooter />
    </div>
  );
}
