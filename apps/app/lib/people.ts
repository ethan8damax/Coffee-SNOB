export type PeopleTab = "followers" | "following" | "find";

export function parsePeopleTab(v: string | undefined): PeopleTab {
  return v === "following" || v === "find" ? v : "followers";
}
