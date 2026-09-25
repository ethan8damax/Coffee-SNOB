import type { Metadata } from "next";
import { Eyebrow } from "@/components/primitives";
import { WebNav, WebFooter } from "@/components/web-chrome";

// The one public home for data credits (the app keeps a single short map
// credit that links here). Add Foursquare, Overture and the monthly index
// download when the coffee index ships (docs/superpowers/specs/
// 2026-09-25-curation-system-design.md).
export const metadata: Metadata = {
  title: "Data sources — Coffee Snob",
  description: "Where the map's cafés, basemap and search come from.",
};

const SOURCES: { name: string; href: string; what: string; licence: string; licenceHref: string }[] = [
  {
    name: "OpenStreetMap",
    href: "https://www.openstreetmap.org",
    what: "Every café on the map, with its address, hours, website and phone.",
    licence: "© OpenStreetMap contributors, ODbL",
    licenceHref: "https://www.openstreetmap.org/copyright",
  },
  {
    name: "OpenFreeMap and OpenMapTiles",
    href: "https://openfreemap.org",
    what: "The basemap: streets, water and place names.",
    licence: "© OpenMapTiles, built from OpenStreetMap data",
    licenceHref: "https://www.openmaptiles.org/",
  },
  {
    name: "Photon by komoot",
    href: "https://photon.komoot.io",
    what: "The search box: cafés and cities by name, worldwide.",
    licence: "Search over OpenStreetMap data",
    licenceHref: "https://github.com/komoot/photon",
  },
];

export default function DataSourcesPage() {
  return (
    <div className="snob-web">
      <WebNav />
      <main>
        <section className="pagehead">
          <div className="wrap pagehead-in">
            <div>
              <Eyebrow>Data sources</Eyebrow>
              <h1 className="h1">Where the map<br />comes <em>from</em></h1>
            </div>
            <div>
              <p className="lede">The cafés, streets and search come from open data. The ratings, logs and write-ups are ours.</p>
            </div>
          </div>
        </section>
        <section className="wrap" style={{ paddingBlock: 48, display: "grid", gap: 32, maxWidth: 720 }}>
          {SOURCES.map((s) => (
            <div key={s.name} style={{ display: "grid", gap: 8 }}>
              <h2 className="h3"><a href={s.href}>{s.name}</a></h2>
              <p className="body">{s.what}</p>
              <p className="body-sm"><a href={s.licenceHref}>{s.licence}</a></p>
            </div>
          ))}
          <p className="body-sm">Something wrong with a café&apos;s details? Fix it on OpenStreetMap and the map picks it up.</p>
        </section>
      </main>
      <WebFooter />
    </div>
  );
}
