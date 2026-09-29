import { describe, expect, it } from "vitest";
import { DAYS, closeTime, formatHours, parseTime, toWebsite, type DayHours } from "./form";

const week = (spec: Partial<Record<(typeof DAYS)[number], [string, string]>>): DayHours[] =>
  DAYS.map((d) => (spec[d] ? { open: true, from: spec[d]![0], to: spec[d]![1] } : { open: false, from: "", to: "" }));

describe("parseTime", () => {
  it.each([
    ["7", "07:00"], ["7am", "07:00"], ["7 AM", "07:00"], ["7:30", "07:30"], ["7.30pm", "19:30"],
    ["15", "15:00"], ["1530", "15:30"], ["730", "07:30"], ["12am", "00:00"], ["12pm", "12:00"], ["noon", "12:00"],
  ])("%s → %s", (input, out) => expect(parseTime(input)).toBe(out));
  it.each(["", "25", "7:75", "13pm", "late"])("%s → null", (input) => expect(parseTime(input)).toBeNull());
});

describe("closeTime", () => {
  it("reads a bare small close time as afternoon", () => expect(closeTime("07:00", "3")).toBe("15:00"));
  it("keeps an explicit time", () => expect(closeTime("07:00", "3am")).toBe("03:00"));
  it("keeps a close after the open", () => expect(closeTime("07:00", "11")).toBe("11:00"));
});

describe("formatHours", () => {
  it("groups runs of the same hours", () => {
    expect(formatHours(week({ Mo: ["7", "3"], Tu: ["7", "3"], We: ["7", "3"], Th: ["7", "3"], Fr: ["7", "3"], Sa: ["8", "2"], Su: ["8", "2"] }))).toBe(
      "Mo-Fr 07:00-15:00; Sa,Su 08:00-14:00",
    );
  });
  it("every day the same", () => {
    const all = week({ Mo: ["7am", "5pm"], Tu: ["7am", "5pm"], We: ["7am", "5pm"], Th: ["7am", "5pm"], Fr: ["7am", "5pm"], Sa: ["7am", "5pm"], Su: ["7am", "5pm"] });
    expect(formatHours(all)).toBe("Mo-Su 07:00-17:00");
  });
  it("leaves closed and half-filled days out", () => {
    expect(formatHours(week({ Tu: ["7", "3"], Th: ["7", ""] }))).toBe("Tu 07:00-15:00");
    expect(formatHours(week({}))).toBe("");
  });
});

describe("toWebsite", () => {
  it.each([
    ["wuzhere.com", "https://wuzhere.com"],
    ["https://wuzhere.com/", "https://wuzhere.com/"],
    ["@wuzhere", "https://www.instagram.com/wuzhere"],
    ["instagram.com/wuz.here", "https://instagram.com/wuz.here"],
    ["", null],
    ["not a site", null],
  ])("%s → %s", (input, out) => expect(toWebsite(input)).toBe(out));
});
