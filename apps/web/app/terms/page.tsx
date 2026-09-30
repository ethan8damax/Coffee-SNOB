import type { Metadata } from "next";
import { Eyebrow } from "@/components/primitives";
import { WebNav, WebFooter } from "@/components/web-chrome";

// Starts with the photo license (docs/superpowers/specs/2026-09-30-photos-design.md,
// section 8). Full Terms of Service and a Privacy Policy are separate work.
export const metadata: Metadata = {
  title: "Terms — Coffee Snob",
  description: "What happens to the photos you add to Coffee Snob.",
};

export default function TermsPage() {
  return (
    <div className="snob-web">
      <WebNav />
      <main>
        <section className="pagehead">
          <div className="wrap pagehead-in">
            <div>
              <Eyebrow>Terms</Eyebrow>
              <h1 className="h1">The <em>fine</em> print</h1>
            </div>
            <div>
              <p className="lede">Short, because it should be.</p>
            </div>
          </div>
        </section>
        <section className="wrap" style={{ paddingBlock: 48, display: "grid", gap: 16, maxWidth: 720 }}>
          <h2 className="h3">Your photos</h2>
          <p className="body">You keep the rights to your photos. When you add one to a log, you let Coffee Snob show it in the app and on this site, including as the header on that shop&apos;s page. It always carries your name.</p>
          <p className="body">Only add photos you took. By adding one, you confirm you did.</p>
          <p className="body">Delete the photo or the log and it comes down. We take down photos that break these rules, and ones people report that don&apos;t hold up.</p>
        </section>
      </main>
      <WebFooter />
    </div>
  );
}
