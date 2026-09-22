# Blog (Journal) CMS Migration Design

Date: 2026-09-22

## Context

The 2026-08-26 spec flagged journal post editing as a real architectural
tension and deliberately left it unresolved: journal posts are
git-committed MDX files (`apps/web/content/journal/*.mdx`), chosen for
static-generation and meta-tag control. The user now wants blog
management in the admin dashboard for real, and asked which direction is
better long-term — this spec makes that call.

## Decision: migrate storage to Supabase, keep MDX rendering

Two options were on the table: (a) keep files and have the dashboard
commit MDX via the GitHub API, or (b) migrate content into Supabase like
`lists`. Neither of those was quite right as framed — the actual answer is
**migrate storage, don't migrate the rendering approach**.

`next-mdx-remote` (already a dependency) compiles MDX from any string, not
just a file on disk — nothing about it requires git. So: move the content
into a `posts` table as a plain text/MDX column, and render it through the
same `next-mdx-remote` pipeline already in use, just sourced from Supabase
instead of `readFileSync`. This keeps full MDX authoring power (headings,
blockquotes, any embedded components a post ever needs) while giving staff
a dashboard form instead of a git commit. The only real loss vs. the
git-file approach is per-line git history — outweighed by "a team member
can edit copy without touching git," which was the original ask.

## Data model

New `posts` table, replacing `apps/web/content/journal/*.mdx` as the
source of truth:

```sql
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,
  author text not null,
  dek text,
  cover_photo_url text,
  cover_photo_alt text,
  read_minutes integer,
  body text not null,              -- MDX source
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Field mapping from current frontmatter: `title`/`category`/`author`/
`dek`/`photoAlt`→`cover_photo_alt`/`readMinutes`→`read_minutes` carry over
directly. `draft: boolean` becomes `status`, matching the `draft`/`live`/
`coming_soon` enum pattern already used on `cities` and `lists` elsewhere
in the schema, for consistency across the admin dashboard's filter chips.
`date` becomes `published_at`, set automatically when status flips to
`published` (not hand-typed).

`cover_photo_url` is new — current posts have no cover image field in code
(`journal.ts` only tracks `photoAlt`); this fills the gap implied by
"team can change photos," uploaded to Supabase Storage from the dashboard
form.

**One-time migration:** a script reads the existing five `.mdx` files via
the current `gray-matter` parsing in `lib/journal.ts`, inserts one row per
file into `posts`, then the files are deleted. Not a dual-write period —
straight cutover, since there are only five posts today.

## Code changes

- `apps/web/lib/journal.ts` — `getAllJournalPosts`/`getJournalPost` read
  from Supabase instead of the filesystem; `next-mdx-remote`'s
  `compileMDX` runs on `posts.body` at request/build time (unchanged
  rendering call, new input source).
- `apps/web/app/(admin)/admin/posts` — new admin page: list (status
  filter chips: Draft/Published), create/edit form (title, category,
  author, dek, cover photo upload, MDX body in a plain textarea — no rich
  WYSIWYG editor; these are long-form editorial pieces authored by people
  already comfortable with Markdown, and a textarea + live preview pane is
  standard for MDX authoring), publish/unpublish toggle.
- RLS: `posts` writes gated by `is_admin()`, same pattern as
  `cities`/`shops`/`lists`. Public reads only `status = 'published'`
  rows — mirrors the existing "no placeholder content" publishing rule in
  `CONTENT-OPS.md`.

## Out of scope

- Rich WYSIWYG editor — a textarea is the right size for this team; revisit
  if non-Markdown-comfortable staff start authoring posts.
- Versioning/revision history beyond `updated_at` — git gave this away for
  free before; nothing replaces it here. Acceptable trade-off per the
  Decision section above.
- Scheduled publishing (publish-at-future-date) — `published_at` is set on
  publish, not schedulable. Add if a real editorial calendar need shows up.
