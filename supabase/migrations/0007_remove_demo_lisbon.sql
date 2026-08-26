-- Lisbon was demo/fixture content that had gone live in production (see
-- docs/superpowers/plans/2026-08-26-marketing-site-truthful-launch.md Task 1).
-- Cascades to shops/lists/list_items via existing FK "on delete cascade"
-- (0001_core.sql, 0002_lists.sql). Fixture preserved for local dev in
-- supabase/seed.dev.sql.
delete from public.cities where slug = 'lisbon';
