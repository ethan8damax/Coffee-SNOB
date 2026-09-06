import type { FeedItem } from "./types";

export function mergeFeedItems(sources: FeedItem[][]): FeedItem[] {
  return sources.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}
