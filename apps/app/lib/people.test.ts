import { describe, it, expect } from "vitest";
import { parsePeopleTab } from "./people";

describe("parsePeopleTab", () => {
  it("accepts known tabs and defaults to followers", () => {
    expect(parsePeopleTab("following")).toBe("following");
    expect(parsePeopleTab("find")).toBe("find");
    expect(parsePeopleTab("nope")).toBe("followers");
    expect(parsePeopleTab(undefined)).toBe("followers");
  });
});
