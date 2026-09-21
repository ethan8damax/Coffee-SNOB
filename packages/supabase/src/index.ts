export { createSupabaseClient } from "./client";
export {
  getCities,
  getCitiesWithShopCounts,
  getCityGuide,
  getProfile,
  isUsernameAvailable,
  saveIdentity,
  saveTastePicks,
  getRatedShopsInBounds,
  logShopVisit,
  getProfilesByIds,
  getCitiesByIds,
  getLogLikes,
  setLogLike,
  getComments,
  getCommentLikes,
  setCommentLike,
  postComment,
  getCommentCountsByLog,
  getFollowedUserIds,
  getFollowingFeedLogs,
  getFollowingFeedLists,
  getShopsInBounds,
  getLogsForShops,
  getLiveCityGuides,
} from "./queries";
export type { Database } from "./types";
// Contract stubs — replaced by real implementations (see contract-stubs.ts header).
export {
  getShopDetail,
  getShopReviews,
  logVisit,
  getPublicProfileByUsername,
  getProfileStats,
  getProfileEntries,
  isFollowing,
  setFollow,
  updateProfile,
} from "./contract-stubs";
export type {
  ShopDetail,
  ShopReview,
  LogVisitInput,
  PublicProfile,
  ProfileStats,
  ProfileEntry,
} from "./contract-stubs";
