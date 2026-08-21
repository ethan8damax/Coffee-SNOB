import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const JOURNAL_DIR = join(process.cwd(), "content", "journal");

export type JournalFrontmatter = {
  title: string;
  category: string;
  author: string;
  date: string;
  readMinutes: number;
  photoAlt: string;
  dek: string;
  draft?: boolean;
};

export type JournalPost = { slug: string; frontmatter: JournalFrontmatter; content: string };

function readAllJournalPosts(): JournalPost[] {
  return readdirSync(JOURNAL_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((file) => {
      const raw = readFileSync(join(JOURNAL_DIR, file), "utf8");
      const { data, content } = matter(raw);
      return { slug: file.replace(/\.mdx$/, ""), frontmatter: data as JournalFrontmatter, content };
    })
    .sort((a, b) => (a.frontmatter.date < b.frontmatter.date ? 1 : -1));
}

export function getAllJournalPosts(): JournalPost[] {
  return readAllJournalPosts().filter((p) => !p.frontmatter.draft);
}

export function getJournalPost(slug: string): JournalPost | undefined {
  return readAllJournalPosts().find((p) => p.slug === slug);
}
