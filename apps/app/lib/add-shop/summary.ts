// "Shops you added": counts for the profile link and the screen's header.
export type SubmissionStatus = "pending" | "approved" | "declined";

export function submissionCounts(list: { status: SubmissionStatus }[]) {
  return {
    onMap: list.filter((s) => s.status === "approved").length,
    waiting: list.filter((s) => s.status === "pending").length,
    passed: list.filter((s) => s.status === "declined").length,
  };
}

export const STATUS_LABEL: Record<SubmissionStatus, string> = { pending: "Waiting", approved: "On the map", declined: "Passed" };

// The profile link's line: what's live first, then what's waiting.
export function addedLine(c: ReturnType<typeof submissionCounts>): string {
  if (c.onMap === 0 && c.waiting === 0) return c.passed ? "None on the map yet." : "Know a shop the map's missing? Add it.";
  const live = `${c.onMap} on the map because of you`;
  return c.waiting ? `${live} · ${c.waiting} waiting` : live;
}
