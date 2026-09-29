import { describe, expect, it } from "vitest";
import { addedLine, submissionCounts } from "./summary";

const of = (...s: ("pending" | "approved" | "declined")[]) => s.map((status) => ({ status }));

describe("submissionCounts / addedLine", () => {
  it("counts each status", () => expect(submissionCounts(of("approved", "approved", "pending", "declined"))).toEqual({ onMap: 2, waiting: 1, passed: 1 }));
  it("nothing sent yet invites one", () => expect(addedLine(submissionCounts([]))).toBe("Know a shop the map's missing? Add it."));
  it("live, then waiting", () => {
    expect(addedLine(submissionCounts(of("approved", "pending")))).toBe("1 on the map because of you · 1 waiting");
    expect(addedLine(submissionCounts(of("pending")))).toBe("0 on the map because of you · 1 waiting");
    expect(addedLine(submissionCounts(of("declined")))).toBe("None on the map yet.");
  });
});
