import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { isChain, type ChainEntry } from "../src";
import fixture from "./fixtures/chains.json";

// isChain (TS) and public.is_chain_name (SQL) are twins: the map filters with
// one, log_shop_visit and shop_ratings with the other. Same fixture, both
// sides, so a rule change to one without the other fails here. Names only:
// the SQL side never sees OSM brand tags.
const blocklist = fixture.blocklist as ChainEntry[];
const MIGRATIONS = join(__dirname, "../../../supabase/migrations");

// The newest definition is the one live in production, so test that one.
function latestIsChainName(): string {
  const re = /create (or replace )?function public\.is_chain_name\b[\s\S]*?\$\$;/gi;
  const defs = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .flatMap((f) => readFileSync(join(MIGRATIONS, f), "utf8").match(re) ?? []);
  if (!defs.length) throw new Error("no is_chain_name definition found in supabase/migrations");
  return defs[defs.length - 1];
}

describe("chain matcher twins", () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.exec("create table public.chain_blocklist (name text primary key, wikidata text);");
    await db.exec(latestIsChainName());
    for (const c of blocklist) {
      await db.query("insert into public.chain_blocklist (name, wikidata) values ($1, $2)", [c.name, c.wikidata]);
    }
  });

  it.each(fixture.cases)("isChain: $name → $isChain", ({ name, isChain: want }) => {
    expect(isChain({ name }, blocklist)).toBe(want);
  });

  it.each(fixture.cases)("is_chain_name: $name → $isChain", async ({ name, isChain: want }) => {
    const { rows } = await db.query<{ v: boolean }>("select public.is_chain_name($1) as v", [name]);
    expect(rows[0].v).toBe(want);
  });
});
