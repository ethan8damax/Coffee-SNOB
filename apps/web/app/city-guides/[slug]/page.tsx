import { notFound } from "next/navigation";
import { Eyebrow, Detour } from "@/components/primitives";
import { WebNav, WebFooter, LetterBand } from "@/components/web-chrome";
import { getSupabase } from "@/lib/supabase";
import { getCityGuide } from "@coffeesnob/supabase";

export const revalidate = 60;

export default async function CityGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getCityGuide(getSupabase(), slug);
  if (!result || !result.guide) notFound();
  const { city, guide } = result;
  const items = guide.list_items;

  return (
    <div className="snob-web">
      <WebNav active="City guides" />
      <section className="chero">
        <div className="photo-ph chero-photo" data-label={`Hero photograph — ${city.name}, morning counter`} style={{ aspectRatio: "21/9" }} />
        <div className="wrap" style={{ padding: "24px 56px" }}>
          <h1 className="h1">{city.name}</h1>
          <span className="label">{city.country}</span>
        </div>
      </section>
      <section className="cintro">
        <div className="wrap cintro-in">
          <p className="lede">{guide.description}</p>
          {guide.body?.split("\n\n").map((para, i) => <p key={i} className="body cintro-body">{para}</p>)}
        </div>
      </section>
      <section className="clist">
        <div className="wrap">
          <div className="sec-head">
            <Eyebrow>The list</Eyebrow>
            <h2 className="h2">Every shop, with<br />the verdict attached.</h2>
          </div>
          <ol className="slist" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map(({ shops: s, note }) => (
              <li key={s.id} className="srow" style={{ display: "flex", gap: 20, padding: "24px 0", borderTop: "1px solid var(--rule)" }}>
                <div className="photo-ph srow-ph" data-label={`${s.name} — counter`} style={{ width: 140, aspectRatio: "4/3", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <h3 className="d3">{s.name}</h3>
                    <span className="label">{s.neighborhood} · {s.tag} · {s.price_tier}</span>
                  </div>
                  <p className="body" style={{ marginTop: 10 }}>{s.writeup}</p>
                  {s.order_note && <p style={{ marginTop: 8 }}><span className="label">Order</span> <span className="body">{s.order_note}</span></p>}
                  {note && <p className="fine">{note}</p>}
                </div>
                {s.editorial_rating != null && <div style={{ flexShrink: 0 }}><Detour value={s.editorial_rating} short /></div>}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <LetterBand />
      <WebFooter />
    </div>
  );
}
