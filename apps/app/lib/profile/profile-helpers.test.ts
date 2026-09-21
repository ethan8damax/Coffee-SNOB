import { describe, it, expect } from "vitest";
import { colors } from "@coffeesnob/design-tokens";
import {
  BIO_MAX,
  NAME_MAX,
  formatCount,
  entryNumber,
  displayNameFor,
  gridColumns,
  tileGround,
  remaining,
  normalizeEdit,
  withFollowerDelta,
  hasMoreEntries,
  PAGE_SIZE,
} from "./profile-helpers";

describe("formatCount", () => {
  it("leaves small numbers alone", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });
  it("abbreviates thousands to one decimal, dropping a trailing .0", () => {
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(1234)).toBe("1.2k");
    expect(formatCount(12500)).toBe("12.5k");
  });
  it("floors rather than rounds up so counts never overstate", () => {
    expect(formatCount(1999)).toBe("1.9k");
  });
  it("abbreviates millions", () => {
    expect(formatCount(2_300_000)).toBe("2.3m");
  });
  it("clamps negatives and non-finite values to 0", () => {
    expect(formatCount(-4)).toBe("0");
    expect(formatCount(Number.NaN)).toBe("0");
  });
});

describe("entryNumber", () => {
  it("numbers newest as the highest", () => {
    expect(entryNumber(0, 12)).toBe(12);
    expect(entryNumber(11, 12)).toBe(1);
  });
  it("uses absolute index so later pages keep counting down", () => {
    expect(entryNumber(30, 45)).toBe(15);
  });
});

describe("displayNameFor", () => {
  it("prefers the display name", () => {
    expect(displayNameFor({ username: "sofia", displayName: "Sofia R." })).toBe("Sofia R.");
  });
  it("falls back to username when name is null, empty or whitespace", () => {
    expect(displayNameFor({ username: "sofia", displayName: null })).toBe("sofia");
    expect(displayNameFor({ username: "sofia", displayName: "  " })).toBe("sofia");
  });
});

describe("gridColumns", () => {
  it("is 3 on phones and 4 from 768 up", () => {
    expect(gridColumns(393)).toBe(3);
    expect(gridColumns(767)).toBe(3);
    expect(gridColumns(768)).toBe(4);
    expect(gridColumns(1440)).toBe(4);
  });
});

describe("tileGround", () => {
  it("is sage-dark with every third tile oxblood", () => {
    expect([0, 1, 2, 3, 4, 5].map(tileGround)).toEqual([
      colors.sageDk,
      colors.sageDk,
      colors.oxblood,
      colors.sageDk,
      colors.sageDk,
      colors.oxblood,
    ]);
  });
});

describe("remaining", () => {
  it("counts characters left", () => {
    expect(remaining("abc", 10)).toBe(7);
    expect(remaining("", BIO_MAX)).toBe(280);
  });
  it("goes negative when over the limit", () => {
    expect(remaining("abcd", 3)).toBe(-1);
  });
});

describe("normalizeEdit", () => {
  it("trims and nulls empty fields", () => {
    expect(normalizeEdit({ displayName: "  Sofia ", bio: "  " })).toEqual({
      ok: true,
      fields: { displayName: "Sofia", bio: null },
    });
  });
  it("rejects over-long fields", () => {
    expect(normalizeEdit({ displayName: "x".repeat(NAME_MAX + 1), bio: "" }).ok).toBe(false);
    expect(normalizeEdit({ displayName: "", bio: "x".repeat(BIO_MAX + 1) }).ok).toBe(false);
  });
  it("accepts exactly the limit", () => {
    expect(normalizeEdit({ displayName: "x".repeat(NAME_MAX), bio: "y".repeat(BIO_MAX) }).ok).toBe(true);
  });
});

describe("withFollowerDelta", () => {
  it("adds or removes one follower without going below zero", () => {
    const s = { entries: 3, followers: 5, following: 2 };
    expect(withFollowerDelta(s, true).followers).toBe(6);
    expect(withFollowerDelta(s, false).followers).toBe(4);
    expect(withFollowerDelta({ ...s, followers: 0 }, false).followers).toBe(0);
  });
});

describe("hasMoreEntries", () => {
  it("is true only when the last page came back full", () => {
    expect(hasMoreEntries(PAGE_SIZE)).toBe(true);
    expect(hasMoreEntries(PAGE_SIZE - 1)).toBe(false);
    expect(hasMoreEntries(0)).toBe(false);
  });
});
