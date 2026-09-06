export type LogFeedCard = {
  type: "log";
  id: string;
  createdAt: string;
  userId: string;
  authorName: string;
  shopName: string;
  shopNeighborhood: string | null;
  rating: number;
  note: string | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
};

export type GuideFeedCard = {
  type: "guide";
  id: string;
  createdAt: string;
  title: string;
  description: string | null;
  cityName: string | null;
  shopCount: number;
};

export type CollectionFeedCard = {
  type: "collection";
  id: string;
  createdAt: string;
  title: string;
  description: string | null;
  curatorName: string;
  shopCount: number;
};

export type FeedItem = LogFeedCard | GuideFeedCard | CollectionFeedCard;
