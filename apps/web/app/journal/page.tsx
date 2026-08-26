import Link from "next/link";
import { Eyebrow, Avatar } from "@/components/primitives";
import { WebNav, WebFooter, LetterBand } from "@/components/web-chrome";
import { getAllJournalPosts } from "@/lib/journal";

export default function JournalIndexPage() {
  const posts = getAllJournalPosts();
  const [featured, ...rest] = posts;

  return (
    <div className="snob-web">
      <WebNav active="Journal" />
      <section className="pagehead">
        <div className="wrap pagehead-in">
          <div>
            <Eyebrow>Journal</Eyebrow>
            <h1 className="h1">Reported from<br />the <em>counter</em></h1>
          </div>
          <p className="lede">Roaster interviews, rooms worth sitting in, and what we learned drinking our way through a city. Everything here was paid for by us, and nothing here was placed.</p>
        </div>
      </section>
      {posts.length === 0 && (
        <section className="wrap" style={{ padding: "clamp(40px,8vw,72px) 0" }}>
          <p className="lede">First letter&rsquo;s still being written. Sign up below and it&rsquo;ll land in your inbox the day it&rsquo;s ready — nothing before then.</p>
        </section>
      )}
      {featured && (
        <section className="jfeat wrap">
          <div className="photo-ph" data-label={featured.frontmatter.photoAlt} style={{ aspectRatio: "4/3" }} />
          <div>
            <span className="label jkicker">{featured.frontmatter.category}</span>
            <Link href={`/journal/${featured.slug}`}><h2 className="h2">{featured.frontmatter.title}</h2></Link>
            <p className="lede" style={{ marginTop: 16 }}>{featured.frontmatter.dek}</p>
            <div className="byline" style={{ marginTop: 24 }}>
              <Avatar name={featured.frontmatter.author} size={26} />
              <span className="label bl-name">{featured.frontmatter.author}</span>
              <span className="bl-dot" />
              <span className="label bl-meta">{featured.frontmatter.readMinutes} min</span>
            </div>
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <section className="jindex">
          <div className="wrap">
            <div className="sec-head"><h2 className="h2" style={{ marginTop: 0 }}>Everything else</h2></div>
            <div className="pgrid">
              {rest.map((p) => (
                <article key={p.slug} className="pcard">
                  <Link href={`/journal/${p.slug}`} className="pcard-link">
                    <div className="photo-ph pcard-photo" data-label={p.frontmatter.photoAlt} />
                    <span className="label pcard-kicker">{p.frontmatter.category}</span>
                    <h3 className="d2 pcard-title">{p.frontmatter.title}</h3>
                    <p className="body pcard-dek">{p.frontmatter.dek}</p>
                  </Link>
                  <div className="pcard-foot">
                    <span className="label pcard-author">{p.frontmatter.author}</span>
                    <span className="label pcard-meta">{p.frontmatter.readMinutes} min</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      <LetterBand />
      <WebFooter />
    </div>
  );
}
