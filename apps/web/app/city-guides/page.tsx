import Link from "next/link";
import { Eyebrow } from "@/components/primitives";
import { WebNav, WebFooter, Doors } from "@/components/web-chrome";
import { getSupabase } from "@/lib/supabase";
import { getCitiesWithShopCounts } from "@coffeesnob/supabase";

export const revalidate = 60;

async function getCityGuidesIndex() {
  const supabase = getSupabase();
  const cities = await getCitiesWithShopCounts(supabase);

  return cities.map((c) => ({
    ...c,
    shops: c.shopCount,
    href: c.status === "live" || c.status === "demo" ? `/city-guides/${c.slug}` : undefined,
  }));
}

export default async function CityGuidesPage() {
  const cities = await getCityGuidesIndex();
  const totalShops = cities.reduce((sum, c) => sum + c.shops, 0);

  return (
    <div className="snob-web">
      <WebNav active="City guides" />
      <main>
        <section className="pagehead">
          <div className="wrap pagehead-in">
            <div>
              <Eyebrow>City guides</Eyebrow>
              <h1 className="h1">Where the<br />coffee is <em>good</em></h1>
            </div>
            <div>
              <p className="lede">One guide per city, written after we have drunk our way through it. No entry we would not walk to ourselves.</p>
              <div style={{ display: "flex", gap: 40, marginTop: 32 }}>
                <div><div className="num" style={{ fontSize: 38 }}>{cities.length}</div><div className="label" style={{ marginTop: 8 }}>Cities mapped</div></div>
                <div><div className="num" style={{ fontSize: 38 }}>{totalShops}</div><div className="label" style={{ marginTop: 8 }}>Shops verified</div></div>
              </div>
            </div>
          </div>
        </section>
        <section className="allcities">
          <div className="wrap">
            <div className="sec-head"><h2 className="h2" style={{ marginTop: 0 }}>Every city</h2></div>
            <div className="cgrid">
              {cities.map((c) => {
                const inner = (
                  <>
                    <div className="photo-ph ccard-photo" data-label={`${c.name} — street or counter photograph`} />
                    <div className="ccard-line">
                      <h3 className="d3">{c.name}</h3>
                      <span className="label ccard-country">{c.country}</span>
                    </div>
                    <div className="ccard-meta">
                      <span className="body-sm">{c.shops > 0 ? <><span className="num">{c.shops}</span> shops</> : "Not yet mapped"}</span>
                    </div>
                  </>
                );
                return c.href
                  ? <Link key={c.id} className="ccard live" href={c.href}>{inner}<span className="ccard-go label">Read guide →</span></Link>
                  : <div key={c.id} className="ccard">{inner}<span className="ccard-go label soon">Guide in progress</span></div>;
              })}
            </div>
            <div className="allcities-seam" />
          </div>
        </section>
      </main>
      <Doors />
      <WebFooter />
    </div>
  );
}
