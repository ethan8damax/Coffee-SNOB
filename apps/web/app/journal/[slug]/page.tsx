import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Avatar } from "@/components/primitives";
import { WebNav, WebFooter, LetterBand } from "@/components/web-chrome";
import { getJournalPost, getAllJournalPosts } from "@/lib/journal";

export function generateStaticParams() {
  return getAllJournalPosts().map((p) => ({ slug: p.slug }));
}

export default async function JournalPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getJournalPost(slug);
  if (!post || post.frontmatter.draft) notFound();

  return (
    <div className="snob-web">
      <WebNav active="Journal" />
      <main>
        <header className="posthead">
          <div className="wrap posthead-in">
            <span className="label ph-kicker">{post.frontmatter.category}</span>
            <h1 className="h1 ph-title">{post.frontmatter.title}</h1>
            <p className="lede ph-dek">{post.frontmatter.dek}</p>
            <div className="ph-foot">
              <div className="byline">
                <Avatar name={post.frontmatter.author} size={30} />
                <span className="label bl-name">{post.frontmatter.author}</span>
                <span className="bl-dot" />
                <span className="label bl-meta">{post.frontmatter.readMinutes} min read</span>
              </div>
            </div>
          </div>
          <div className="ph-photo photo-ph" data-label={post.frontmatter.photoAlt} />
        </header>
        <section className="post">
          <div className="wrap post-in" style={{ gridTemplateColumns: "1fr" }}>
            <div className="post-col">
              <MDXRemote source={post.content} />
            </div>
          </div>
        </section>
      </main>
      <LetterBand />
      <WebFooter />
    </div>
  );
}
