import type { FeedItem } from "./types";

export function mergeFeedItems(sources: FeedItem[][]): FeedItem[] {
  return sources.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
