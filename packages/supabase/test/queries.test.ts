import { describe, it, expect, vi } from "vitest";
import { getCities, getCitiesWithShopCounts, getCityGuide, getProfile, isUsernameAvailable, saveIdentity, saveTastePicks, getRatedShopsInBounds, logShopVisit, getProfilesByIds, getCitiesByIds, getLogLikes, setLogLike, getComments, getCommentLikes, setCommentLike, postComment, getCommentCountsByLog, getFollowedUserIds, getFollowingFeedLogs, getFollowingFeedLists, getShopsInBounds, getLogsForShops, getLiveCityGuides, summarizeVerdicts, getShopDetail, getShopReviews, logVisit, getPublicProfileByUsername, getProfileStats, getProfileEntries, isFollowing, setFollow, updateProfile, getAdminUserDirectory, setUserStatus, setUserAdmin, createCity, updateCity, searchRatedShops } from "../src/queries";
import { createShop, updateShop, upsertShopCuration, rejectShopPromotion, getAdminShops } from "../src/queries";
import { createCityGuide, updateCityGuide, getCityGuideItems, setCityGuideItems, getAdminCityGuides } from "../src/queries";

function fakeClient(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  } as any;
}

describe("getCities", () => {
  it("returns the rows the client resolves with", async () => {
    const client = fakeClient([{ slug: "lisbon", name: "Lisbon" }]);
    const cities = await getCities(client);
    expect(cities).toEqual([{ slug: "lisbon", name: "Lisbon" }]);
  });

  it("throws when the client returns an error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({ data: null, error: new Error("boom") }),
        }),
      }),
    } as any;
    await expect(getCities(client)).rejects.toThrow("boom");
  });
});

describe("getCitiesWithShopCounts", () => {
  it("joins shop counts from published city guides onto each city", async () => {
    const client = {
      from: (table: string) => {
        if (table === "cities") {
          return {
            select: () => ({
              order: () => Promise.resolve({
                data: [
                  { id: "c1", slug: "lisbon", name: "Lisbon", country: "Portugal", region: "Europe", status: "demo" },
                  { id: "c2", slug: "tampa", name: "Tampa", country: "United States", region: "North America", status: "coming_soon" },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "lists") {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [{ city_id: "c1", list_items: [{ count: 7 }] }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const cities = await getCitiesWithShopCounts(client);
    expect(cities).toEqual([
      { id: "c1", slug: "lisbon", name: "Lisbon", country: "Portugal", region: "Europe", status: "demo", shopCount: 7 },
      { id: "c2", slug: "tampa", name: "Tampa", country: "United States", region: "North America", status: "coming_soon", shopCount: 0 },
    ]);
  });
});

// fake client that dispatches by table name: "cities" (single .eq) vs "lists" (double .eq)
function fakeGuideClient(
  cityResult: { data: unknown; error: unknown },
  guideResult?: { data: unknown; error: unknown }
) {
  return {
    from: (table: string) => {
      if (table === "cities") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(cityResult),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                maybeSingle: () => Promise.resolve(guideResult),
              }),
            }),
          }),
        }),
      };
    },
  } as any;
}

describe("getCityGuide", () => {
  it("returns null when the city doesn't exist", async () => {
    const client = fakeGuideClient({ data: null, error: null });
    const result = await getCityGuide(client, "nowhere");
    expect(result).toBeNull();
  });

  it("returns { city, guide: null } when the city exists but has no guide", async () => {
    const city = { id: "1", slug: "portland", name: "Portland" };
    const client = fakeGuideClient(
      { data: city, error: null },
      { data: null, error: null }
    );
    const result = await getCityGuide(client, "portland");
    expect(result).toEqual({ city, guide: null });
  });

  it("returns { city, guide } when both exist", async () => {
    const city = { id: "1", slug: "lisbon", name: "Lisbon" };
    const guide = {
      id: "g1",
      slug: "lisbon-guide",
      title: "Lisbon Guide",
      list_items: [
        {
          position: 1,
          note: null,
          shops: {
            id: "s1",
            name: "Noi Coffee",
            neighborhood: "Príncipe Real",
            shop_curations: { price_tier: "€€", tag: "Espresso bar", writeup: "Great bar.", order_note: null, editorial_rating: 5 },
          },
        },
      ],
    };
    const client = fakeGuideClient(
      { data: city, error: null },
      { data: guide, error: null }
    );
    const result = await getCityGuide(client, "lisbon");
    expect(result).toEqual({ city, guide });
  });

  it("throws when the city lookup returns an error", async () => {
    const client = fakeGuideClient({ data: null, error: new Error("city boom") });
    await expect(getCityGuide(client, "lisbon")).rejects.toThrow("city boom");
  });

  it("throws when the guide lookup returns an error", async () => {
    const city = { id: "1", slug: "lisbon", name: "Lisbon" };
    const client = fakeGuideClient(
      { data: city, error: null },
      { data: null, error: new Error("guide boom") }
    );
    await expect(getCityGuide(client, "lisbon")).rejects.toThrow("guide boom");
  });
});

function fakeSelectEqMaybeSingle(row: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: row, error: null }),
        }),
      }),
    }),
  } as any;
}

describe("getProfile", () => {
  it("returns the profile row for a user id", async () => {
    const client = fakeSelectEqMaybeSingle({ id: "u1", username: "mara" });
    expect(await getProfile(client, "u1")).toEqual({ id: "u1", username: "mara" });
  });

  it("returns null when no profile row exists", async () => {
    const client = fakeSelectEqMaybeSingle(null);
    expect(await getProfile(client, "missing")).toBeNull();
  });
});

function fakeUsernameCheckClient(row: unknown) {
  const maybeSingleSpy = vi.fn(() => Promise.resolve({ data: row, error: null }));
  const neqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
  const eqSpy = vi.fn(() => ({ neq: neqSpy }));
  const selectSpy = vi.fn(() => ({ eq: eqSpy }));
  const fromSpy = vi.fn(() => ({ select: selectSpy }));
  const client = { from: fromSpy } as any;
  return { client, fromSpy, selectSpy, eqSpy, neqSpy };
}

describe("isUsernameAvailable", () => {
  it("is true when no other profile has the username", async () => {
    const { client, fromSpy, selectSpy, eqSpy, neqSpy } = fakeUsernameCheckClient(null);

    expect(await isUsernameAvailable(client, "maradrinks", "u1")).toBe(true);

    expect(fromSpy).toHaveBeenCalledWith("profiles");
    expect(selectSpy).toHaveBeenCalledWith("id");
    expect(eqSpy).toHaveBeenCalledWith("username", "maradrinks");
    expect(neqSpy).toHaveBeenCalledWith("id", "u1");
  });

  it("is false when another profile already has the username", async () => {
    const { client, fromSpy, selectSpy, eqSpy, neqSpy } = fakeUsernameCheckClient({ id: "u2" });

    expect(await isUsernameAvailable(client, "maradrinks", "u1")).toBe(false);

    expect(fromSpy).toHaveBeenCalledWith("profiles");
    expect(selectSpy).toHaveBeenCalledWith("id");
    expect(eqSpy).toHaveBeenCalledWith("username", "maradrinks");
    expect(neqSpy).toHaveBeenCalledWith("id", "u1");
  });
});

describe("saveIdentity", () => {
  it("updates username and display_name for the given user", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }));
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const client = { from: () => ({ update: updateSpy }) } as any;

    await saveIdentity(client, "u1", { username: "maradrinks", displayName: "Mara Köster" });

    expect(updateSpy).toHaveBeenCalledWith({ username: "maradrinks", display_name: "Mara Köster" });
    expect(eqSpy).toHaveBeenCalledWith("id", "u1");
  });

  it("throws when the update errors", async () => {
    const client = {
      from: () => ({
        update: () => ({ eq: () => Promise.resolve({ error: new Error("taken") }) }),
      }),
    } as any;
    await expect(
      saveIdentity(client, "u1", { username: "maradrinks", displayName: "Mara Köster" })
    ).rejects.toThrow("taken");
  });
});

describe("saveTastePicks", () => {
  it("updates taste_picks and stamps onboarded_at", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }));
    const updateSpy = vi.fn((_payload: { taste_picks: string[]; onboarded_at: string }) => ({ eq: eqSpy }));
    const client = { from: () => ({ update: updateSpy }) } as any;

    await saveTastePicks(client, "u1", ["espresso", "filter"]);

    const [payload] = updateSpy.mock.calls[0];
    expect(payload.taste_picks).toEqual(["espresso", "filter"]);
    expect(typeof payload.onboarded_at).toBe("string");
    expect(eqSpy).toHaveBeenCalledWith("id", "u1");
  });
});

describe("getRatedShopsInBounds", () => {
  it("queries shop_ratings within the given lat/lng box", async () => {
    const geSpy = vi.fn(() => ({ lte: vi.fn(() => ({ gte: vi.fn(() => ({ lte: () => Promise.resolve({ data: [{ id: "s1", name: "Noi Coffee" }], error: null }) })) })) }));
    const selectSpy = vi.fn(() => ({ gte: geSpy }));
    const client = { from: () => ({ select: selectSpy }) } as any;

    const shops = await getRatedShopsInBounds(client, { minLat: 38.7, maxLat: 38.8, minLng: -9.2, maxLng: -9.1 });

    expect(shops).toEqual([{ id: "s1", name: "Noi Coffee" }]);
    expect(selectSpy).toHaveBeenCalledWith("id, name, lat, lng, neighborhood, is_snob_approved, tag, price_tier, rating, log_count, external_id");
  });

  it("throws when the client returns an error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          gte: () => ({ lte: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: null, error: new Error("boom") }) }) }) }),
        }),
      }),
    } as any;
    await expect(
      getRatedShopsInBounds(client, { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 })
    ).rejects.toThrow("boom");
  });
});

describe("logShopVisit", () => {
  it("calls the log_shop_visit RPC with snake_case params", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: { id: "l1" }, error: null }));
    const client = { rpc: rpcSpy } as any;

    const log = await logShopVisit(client, {
      externalId: "node/1",
      name: "Corner Cafe",
      lat: 38.7,
      lng: -9.1,
      rating: 5,
      note: "Great",
    });

    expect(log).toEqual({ id: "l1" });
    expect(rpcSpy).toHaveBeenCalledWith("log_shop_visit", {
      p_external_id: "node/1",
      p_name: "Corner Cafe",
      p_lat: 38.7,
      p_lng: -9.1,
      p_rating: 5,
      p_note: "Great",
      p_visited_at: undefined,
    });
  });

  it("throws when the RPC returns an error", async () => {
    const client = { rpc: () => Promise.resolve({ data: null, error: new Error("must be authenticated to log a visit") }) } as any;
    await expect(
      logShopVisit(client, { externalId: "node/1", name: "Corner Cafe", lat: 38.7, lng: -9.1, rating: 5 })
    ).rejects.toThrow("must be authenticated to log a visit");
  });
});

describe("getProfilesByIds", () => {
  it("returns an empty array without querying when given no ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getProfilesByIds(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries profiles by id", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ id: "u1", username: "mara", display_name: "Mara K.", avatar_url: null }], error: null }));
    const selectSpy = vi.fn(() => ({ in: inSpy }));
    const client = { from: () => ({ select: selectSpy }) } as any;

    const profiles = await getProfilesByIds(client, ["u1"]);

    expect(profiles).toEqual([{ id: "u1", username: "mara", display_name: "Mara K.", avatar_url: null }]);
    expect(selectSpy).toHaveBeenCalledWith("id, username, display_name, avatar_url");
    expect(inSpy).toHaveBeenCalledWith("id", ["u1"]);
  });

  it("throws when the client returns an error", async () => {
    const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: new Error("boom") }) }) }) } as any;
    await expect(getProfilesByIds(client, ["u1"])).rejects.toThrow("boom");
  });
});

describe("getCitiesByIds", () => {
  it("returns an empty array without querying when given no ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getCitiesByIds(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries cities by id", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ id: "c1", name: "Berlin" }], error: null }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;
    expect(await getCitiesByIds(client, ["c1"])).toEqual([{ id: "c1", name: "Berlin" }]);
    expect(inSpy).toHaveBeenCalledWith("id", ["c1"]);
  });
});

describe("getLogLikes", () => {
  it("returns an empty array without querying when given no log ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getLogLikes(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries log_likes for the given log ids", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ log_id: "l1", user_id: "u1" }], error: null }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;
    expect(await getLogLikes(client, ["l1"])).toEqual([{ log_id: "l1", user_id: "u1" }]);
    expect(inSpy).toHaveBeenCalledWith("log_id", ["l1"]);
  });
});

describe("setLogLike", () => {
  it("inserts a row when liked is true", async () => {
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }));
    const client = { from: () => ({ insert: insertSpy }) } as any;
    await setLogLike(client, "l1", "u1", true);
    expect(insertSpy).toHaveBeenCalledWith({ log_id: "l1", user_id: "u1" });
  });

  it("deletes the row when liked is false", async () => {
    const eqSpy2 = vi.fn(() => Promise.resolve({ error: null }));
    const eqSpy1 = vi.fn(() => ({ eq: eqSpy2 }));
    const deleteSpy = vi.fn(() => ({ eq: eqSpy1 }));
    const client = { from: () => ({ delete: deleteSpy }) } as any;
    await setLogLike(client, "l1", "u1", false);
    expect(eqSpy1).toHaveBeenCalledWith("log_id", "l1");
    expect(eqSpy2).toHaveBeenCalledWith("user_id", "u1");
  });

  it("throws when the insert errors", async () => {
    const client = { from: () => ({ insert: () => Promise.resolve({ error: new Error("boom") }) }) } as any;
    await expect(setLogLike(client, "l1", "u1", true)).rejects.toThrow("boom");
  });
});

describe("getComments", () => {
  it("queries comments for a log ordered oldest first", async () => {
    const orderSpy = vi.fn(() => Promise.resolve({ data: [{ id: "c1", parent_comment_id: null, user_id: "u1", body: "hi", created_at: "t1" }], error: null }));
    const eqSpy = vi.fn(() => ({ order: orderSpy }));
    const selectSpy = vi.fn(() => ({ eq: eqSpy }));
    const client = { from: () => ({ select: selectSpy }) } as any;

    const comments = await getComments(client, "l1");

    expect(comments).toEqual([{ id: "c1", parent_comment_id: null, user_id: "u1", body: "hi", created_at: "t1" }]);
    expect(eqSpy).toHaveBeenCalledWith("log_id", "l1");
    expect(orderSpy).toHaveBeenCalledWith("created_at", { ascending: true });
  });
});

describe("getCommentLikes", () => {
  it("returns an empty array without querying when given no comment ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getCommentLikes(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries comment_likes for the given comment ids", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ comment_id: "c1", user_id: "u1" }], error: null }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;
    expect(await getCommentLikes(client, ["c1"])).toEqual([{ comment_id: "c1", user_id: "u1" }]);
  });
});

describe("setCommentLike", () => {
  it("inserts a row when liked is true", async () => {
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }));
    const client = { from: () => ({ insert: insertSpy }) } as any;
    await setCommentLike(client, "c1", "u1", true);
    expect(insertSpy).toHaveBeenCalledWith({ comment_id: "c1", user_id: "u1" });
  });

  it("deletes the row when liked is false", async () => {
    const eqSpy2 = vi.fn(() => Promise.resolve({ error: null }));
    const eqSpy1 = vi.fn(() => ({ eq: eqSpy2 }));
    const client = { from: () => ({ delete: () => ({ eq: eqSpy1 }) }) } as any;
    await setCommentLike(client, "c1", "u1", false);
    expect(eqSpy1).toHaveBeenCalledWith("comment_id", "c1");
    expect(eqSpy2).toHaveBeenCalledWith("user_id", "u1");
  });
});

describe("postComment", () => {
  it("inserts a comment and returns the created row", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: { id: "c1", log_id: "l1", user_id: "u1", parent_comment_id: null, body: "hi", created_at: "t1" }, error: null }));
    const selectSpy = vi.fn(() => ({ single: singleSpy }));
    const insertSpy = vi.fn(() => ({ select: selectSpy }));
    const client = { from: () => ({ insert: insertSpy }) } as any;

    const comment = await postComment(client, { logId: "l1", userId: "u1", body: "hi" });

    expect(comment).toEqual({ id: "c1", log_id: "l1", user_id: "u1", parent_comment_id: null, body: "hi", created_at: "t1" });
    expect(insertSpy).toHaveBeenCalledWith({ log_id: "l1", user_id: "u1", body: "hi", parent_comment_id: null });
  });

  it("passes parentCommentId through when replying", async () => {
    const singleSpy = vi.fn(() => Promise.resolve({ data: {}, error: null }));
    const insertSpy = vi.fn(() => ({ select: () => ({ single: singleSpy }) }));
    const client = { from: () => ({ insert: insertSpy }) } as any;

    await postComment(client, { logId: "l1", userId: "u1", body: "reply", parentCommentId: "c1" });

    expect(insertSpy).toHaveBeenCalledWith({ log_id: "l1", user_id: "u1", body: "reply", parent_comment_id: "c1" });
  });

  it("throws when the insert errors", async () => {
    const client = { from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error("cannot reply to a reply") }) }) }) }) } as any;
    await expect(postComment(client, { logId: "l1", userId: "u1", body: "x", parentCommentId: "c2" })).rejects.toThrow("cannot reply to a reply");
  });
});

describe("getCommentCountsByLog", () => {
  it("returns an empty array without querying when given no log ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getCommentCountsByLog(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries comment log_ids for the given log ids", async () => {
    const inSpy = vi.fn(() => Promise.resolve({ data: [{ log_id: "l1" }, { log_id: "l1" }], error: null }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;
    expect(await getCommentCountsByLog(client, ["l1"])).toEqual([{ log_id: "l1" }, { log_id: "l1" }]);
  });
});

describe("getFollowedUserIds", () => {
  it("returns the followee ids for a follower", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ data: [{ followee_id: "u2" }, { followee_id: "u3" }], error: null }));
    const client = { from: () => ({ select: () => ({ eq: eqSpy }) }) } as any;
    expect(await getFollowedUserIds(client, "u1")).toEqual(["u2", "u3"]);
    expect(eqSpy).toHaveBeenCalledWith("follower_id", "u1");
  });
});

describe("getFollowingFeedLogs", () => {
  it("returns an empty array without querying when given no followee ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getFollowingFeedLogs(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries logs from the given users, newest first, with shop details", async () => {
    const orderSpy = vi.fn(() => ({ limit: () => Promise.resolve({ data: [{ id: "l1", shops: { name: "Noi Coffee", neighborhood: "Príncipe Real" } }], error: null }) }));
    const inSpy = vi.fn(() => ({ order: orderSpy }));
    const selectSpy = vi.fn(() => ({ in: inSpy }));
    const client = { from: () => ({ select: selectSpy }) } as any;

    const logs = await getFollowingFeedLogs(client, ["u2"]);

    expect(logs).toEqual([{ id: "l1", shops: { name: "Noi Coffee", neighborhood: "Príncipe Real" } }]);
    expect(inSpy).toHaveBeenCalledWith("user_id", ["u2"]);
    expect(orderSpy).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("getFollowingFeedLists", () => {
  it("includes editorial lists (curator_id is null) even with no followees", async () => {
    const orSpy = vi.fn(() => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }));
    const client = { from: () => ({ select: () => ({ or: orSpy }) }) } as any;

    await getFollowingFeedLists(client, []);

    expect(orSpy).toHaveBeenCalledWith("curator_id.is.null");
  });

  it("includes followees' lists when there are any", async () => {
    const orSpy = vi.fn(() => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }));
    const client = { from: () => ({ select: () => ({ or: orSpy }) }) } as any;

    await getFollowingFeedLists(client, ["u2", "u3"]);

    expect(orSpy).toHaveBeenCalledWith("curator_id.is.null,curator_id.in.(u2,u3)");
  });
});

describe("getShopsInBounds", () => {
  it("queries shops within the given lat/lng box", async () => {
    const geSpy = vi.fn(() => ({ lte: vi.fn(() => ({ gte: vi.fn(() => ({ lte: () => Promise.resolve({ data: [{ id: "s1", name: "Noi Coffee" }], error: null }) })) })) }));
    const client = { from: () => ({ select: () => ({ gte: geSpy }) }) } as any;

    const shops = await getShopsInBounds(client, { minLat: 38.7, maxLat: 38.8, minLng: -9.2, maxLng: -9.1 });

    expect(shops).toEqual([{ id: "s1", name: "Noi Coffee" }]);
  });
});

describe("getLogsForShops", () => {
  it("returns an empty array without querying when given no shop ids", async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as any;
    expect(await getLogsForShops(client, [])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("queries logs for the given shops, newest first", async () => {
    const orderSpy = vi.fn(() => ({ limit: () => Promise.resolve({ data: [{ id: "l1", shop_id: "s1" }], error: null }) }));
    const inSpy = vi.fn(() => ({ order: orderSpy }));
    const client = { from: () => ({ select: () => ({ in: inSpy }) }) } as any;

    expect(await getLogsForShops(client, ["s1"])).toEqual([{ id: "l1", shop_id: "s1" }]);
    expect(inSpy).toHaveBeenCalledWith("shop_id", ["s1"]);
  });
});

describe("getLiveCityGuides", () => {
  it("returns an empty array without querying lists when no cities are live", async () => {
    const client = {
      from: (table: string) => {
        if (table === "cities") return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
        throw new Error(`unexpected table ${table}`);
      },
    } as any;
    expect(await getLiveCityGuides(client)).toEqual([]);
  });

  it("queries city_guide lists in live cities and attaches the city name", async () => {
    const client = {
      from: (table: string) => {
        if (table === "cities") {
          return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "c1", name: "Berlin" }], error: null }) }) };
        }
        if (table === "lists") {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [{ id: "g1", title: "Six cups", city_id: "c1" }], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    expect(await getLiveCityGuides(client)).toEqual([{ id: "g1", title: "Six cups", city_id: "c1", cityName: "Berlin" }]);
  });
});

describe("summarizeVerdicts", () => {
  it("returns nulls and zero count for no ratings", () => {
    expect(summarizeVerdicts([])).toEqual({ rating: null, logCount: 0, topVerdict: null });
  });

  it("averages to one decimal and picks the most common verdict", () => {
    expect(summarizeVerdicts([5, 4, 4])).toEqual({ rating: 4.3, logCount: 3, topVerdict: 4 });
  });

  it("breaks verdict ties toward the higher verdict", () => {
    expect(summarizeVerdicts([2, 5, 2, 5, 3])).toEqual({ rating: 3.4, logCount: 5, topVerdict: 5 });
  });
});

describe("getShopDetail", () => {
  const shopRow = { id: "s1", name: "Corner", neighborhood: null, lat: 38.7, lng: -9.1, address: "1 Main", website: null, phone: null, hours: "Mo-Fr 07:00-18:00" };

  function shopClient(shop: unknown, logs: { data: unknown; error: unknown }, shopError: unknown = null) {
    return {
      from: (table: string) => {
        if (table === "shops") {
          return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: shop, error: shopError }) }) }) };
        }
        if (table === "logs") return { select: () => ({ eq: () => Promise.resolve(logs) }) };
        throw new Error(`unexpected table ${table}`);
      },
    } as any;
  }

  it("returns null when the shop does not exist", async () => {
    expect(await getShopDetail(shopClient(null, { data: [], error: null }), "nope")).toBeNull();
  });

  it("merges the shop row with aggregated verdicts", async () => {
    const client = shopClient(shopRow, { data: [{ rating: 5 }, { rating: 4 }, { rating: 5 }], error: null });
    expect(await getShopDetail(client, "s1")).toEqual({ ...shopRow, rating: 4.7, logCount: 3, topVerdict: 5 });
  });

  it("has null rating and topVerdict and zero count when the shop has no logs", async () => {
    const client = shopClient(shopRow, { data: [], error: null });
    expect(await getShopDetail(client, "s1")).toMatchObject({ rating: null, logCount: 0, topVerdict: null });
  });

  it("throws when the shop query errors", async () => {
    await expect(getShopDetail(shopClient(null, { data: [], error: null }, new Error("boom")), "s1")).rejects.toThrow("boom");
  });

  it("throws when the logs query errors", async () => {
    await expect(getShopDetail(shopClient(shopRow, { data: null, error: new Error("logs boom") }), "s1")).rejects.toThrow("logs boom");
  });
});

describe("getShopReviews", () => {
  const logRow = { id: "l1", user_id: "u1", rating: 5, note: "great", drink: "flat white", visited_at: "2026-09-01", created_at: "2026-09-01T10:00:00Z" };

  function reviewsClient(logs: { data: unknown; error: unknown }, profiles: { data: unknown; error: unknown }) {
    const limitSpy = vi.fn();
    const client = {
      from: (table: string) => {
        if (table === "logs") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: (n: number) => {
                    limitSpy(n);
                    return Promise.resolve(logs);
                  },
                }),
              }),
            }),
          };
        }
        if (table === "profiles") return { select: () => ({ in: () => Promise.resolve(profiles) }) };
        throw new Error(`unexpected table ${table}`);
      },
    } as any;
    return { client, limitSpy };
  }

  it("maps logs + author profiles into camelCase reviews", async () => {
    const { client, limitSpy } = reviewsClient(
      { data: [logRow], error: null },
      { data: [{ id: "u1", username: "mara", display_name: "Mara K.", avatar_url: null }], error: null }
    );
    expect(await getShopReviews(client, "s1", { limit: 5 })).toEqual([
      { id: "l1", userId: "u1", username: "mara", displayName: "Mara K.", rating: 5, note: "great", drink: "flat white", visitedAt: "2026-09-01", createdAt: "2026-09-01T10:00:00Z" },
    ]);
    expect(limitSpy).toHaveBeenCalledWith(5);
  });

  it("returns [] without querying profiles when there are no logs", async () => {
    const { client } = reviewsClient({ data: [], error: null }, { data: null, error: new Error("should not be called") });
    expect(await getShopReviews(client, "s1")).toEqual([]);
  });

  it("throws when the logs query errors", async () => {
    const { client } = reviewsClient({ data: null, error: new Error("boom") }, { data: [], error: null });
    await expect(getShopReviews(client, "s1")).rejects.toThrow("boom");
  });
});

describe("logVisit", () => {
  it("inserts a log for an existing shop and returns shop and log ids", async () => {
    const insertSpy = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "l1", shop_id: "s1" }, error: null }) }) }));
    const client = { from: () => ({ insert: insertSpy }) } as any;

    const result = await logVisit(client, "u1", { kind: "existing", shopId: "s1", rating: 4, drink: "  cortado ", note: "" });

    expect(result).toEqual({ shopId: "s1", logId: "l1" });
    expect(insertSpy).toHaveBeenCalledWith({ user_id: "u1", shop_id: "s1", rating: 4, note: null, drink: "cortado", visited_at: undefined });
  });

  it("throws when the existing-shop insert errors", async () => {
    const client = { from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error("rls") }) }) }) }) } as any;
    await expect(logVisit(client, "u1", { kind: "existing", shopId: "s1", rating: 4 })).rejects.toThrow("rls");
  });

  it("calls the log_shop_visit RPC for an OSM shop and unwraps the returned row", async () => {
    const rpcSpy = vi.fn(() => Promise.resolve({ data: [{ shop_id: "s9", log_id: "l9" }], error: null }));
    const client = { rpc: rpcSpy } as any;

    const result = await logVisit(client, "u1", {
      kind: "osm",
      externalId: "node/1",
      name: "Corner",
      lat: 38.7,
      lng: -9.1,
      rating: 5,
      note: "yes",
      drink: "espresso",
      address: "1 Main",
      website: "https://x.co",
      phone: "555",
      hours: "Mo-Fr 07:00-18:00",
      visitedAt: "2026-09-01",
    });

    expect(result).toEqual({ shopId: "s9", logId: "l9" });
    expect(rpcSpy).toHaveBeenCalledWith("log_shop_visit", {
      p_external_id: "node/1",
      p_name: "Corner",
      p_lat: 38.7,
      p_lng: -9.1,
      p_rating: 5,
      p_note: "yes",
      p_visited_at: "2026-09-01",
      p_drink: "espresso",
      p_address: "1 Main",
      p_website: "https://x.co",
      p_phone: "555",
      p_hours: "Mo-Fr 07:00-18:00",
    });
  });

  it("throws when the RPC errors", async () => {
    const client = { rpc: () => Promise.resolve({ data: null, error: new Error("must be authenticated to log a visit") }) } as any;
    await expect(logVisit(client, "u1", { kind: "osm", externalId: "n/1", name: "C", lat: 1, lng: 2, rating: 3 })).rejects.toThrow("must be authenticated");
  });

  it("throws when the RPC returns no row", async () => {
    const client = { rpc: () => Promise.resolve({ data: [], error: null }) } as any;
    await expect(logVisit(client, "u1", { kind: "osm", externalId: "n/1", name: "C", lat: 1, lng: 2, rating: 3 })).rejects.toThrow();
  });
});

describe("getPublicProfileByUsername", () => {
  it("maps the profile row to camelCase", async () => {
    const eqSpy = vi.fn(() => ({
      maybeSingle: () =>
        Promise.resolve({ data: { id: "u1", username: "mara", display_name: "Mara K.", bio: "hi", avatar_url: null, created_at: "2026-01-01T00:00:00Z" }, error: null }),
    }));
    const client = { from: () => ({ select: () => ({ eq: eqSpy }) }) } as any;
    expect(await getPublicProfileByUsername(client, "mara")).toEqual({
      id: "u1", username: "mara", displayName: "Mara K.", bio: "hi", avatarUrl: null, createdAt: "2026-01-01T00:00:00Z",
    });
    expect(eqSpy).toHaveBeenCalledWith("username", "mara");
  });

  it("returns null when no profile matches", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) } as any;
    expect(await getPublicProfileByUsername(client, "ghost")).toBeNull();
  });

  it("throws on error", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: new Error("boom") }) }) }) }) } as any;
    await expect(getPublicProfileByUsername(client, "x")).rejects.toThrow("boom");
  });
});

describe("getProfileStats", () => {
  function statsClient(counts: Record<string, { count: number | null; error: unknown }>) {
    const eqSpy = vi.fn();
    const client = {
      from: (table: string) => ({
        select: () => ({
          eq: (col: string, val: string) => {
            eqSpy(table, col, val);
            return Promise.resolve(counts[`${table}.${col}`]);
          },
        }),
      }),
    } as any;
    return { client, eqSpy };
  }

  it("counts entries, followers and following", async () => {
    const { client, eqSpy } = statsClient({
      "logs.user_id": { count: 7, error: null },
      "follows.followee_id": { count: 3, error: null },
      "follows.follower_id": { count: 2, error: null },
    });
    expect(await getProfileStats(client, "u1")).toEqual({ entries: 7, followers: 3, following: 2 });
    expect(eqSpy).toHaveBeenCalledWith("logs", "user_id", "u1");
    expect(eqSpy).toHaveBeenCalledWith("follows", "followee_id", "u1");
    expect(eqSpy).toHaveBeenCalledWith("follows", "follower_id", "u1");
  });

  it("treats null counts as zero", async () => {
    const { client } = statsClient({
      "logs.user_id": { count: null, error: null },
      "follows.followee_id": { count: null, error: null },
      "follows.follower_id": { count: null, error: null },
    });
    expect(await getProfileStats(client, "u1")).toEqual({ entries: 0, followers: 0, following: 0 });
  });

  it("throws when any count errors", async () => {
    const { client } = statsClient({
      "logs.user_id": { count: 1, error: null },
      "follows.followee_id": { count: null, error: new Error("boom") },
      "follows.follower_id": { count: 1, error: null },
    });
    await expect(getProfileStats(client, "u1")).rejects.toThrow("boom");
  });
});

describe("getProfileEntries", () => {
  const row = {
    id: "l1", shop_id: "s1", rating: 4, note: null, drink: "drip", visited_at: "2026-09-01", created_at: "2026-09-01T10:00:00Z",
    shops: { name: "Corner", neighborhood: "Alfama" },
  };

  function entriesClient(result: { data: unknown; error: unknown }) {
    const rangeSpy = vi.fn(() => Promise.resolve(result));
    const orderSpy = vi.fn();
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: (col: string, opts: unknown) => {
              orderSpy(col, opts);
              return {
                order: (col2: string, opts2: unknown) => {
                  orderSpy(col2, opts2);
                  return { range: rangeSpy };
                },
              };
            },
          }),
        }),
      }),
    } as any;
    return { client, rangeSpy, orderSpy };
  }

  it("maps rows, orders newest first and pages with offset/limit", async () => {
    const { client, rangeSpy, orderSpy } = entriesClient({ data: [row], error: null });
    expect(await getProfileEntries(client, "u1", { limit: 10, offset: 20 })).toEqual([
      { id: "l1", shopId: "s1", shopName: "Corner", shopNeighborhood: "Alfama", rating: 4, note: null, drink: "drip", visitedAt: "2026-09-01", createdAt: "2026-09-01T10:00:00Z" },
    ]);
    expect(orderSpy).toHaveBeenNthCalledWith(1, "visited_at", { ascending: false });
    expect(orderSpy).toHaveBeenNthCalledWith(2, "created_at", { ascending: false });
    expect(rangeSpy).toHaveBeenCalledWith(20, 29);
  });

  it("defaults to the first 20 entries and returns [] when empty", async () => {
    const { client, rangeSpy } = entriesClient({ data: [], error: null });
    expect(await getProfileEntries(client, "u1")).toEqual([]);
    expect(rangeSpy).toHaveBeenCalledWith(0, 19);
  });

  it("throws on error", async () => {
    const { client } = entriesClient({ data: null, error: new Error("boom") });
    await expect(getProfileEntries(client, "u1")).rejects.toThrow("boom");
  });
});

describe("isFollowing", () => {
  function followClient(result: { data: unknown; error: unknown }) {
    return { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(result) }) }) }) }) } as any;
  }

  it("is true when a follow row exists", async () => {
    expect(await isFollowing(followClient({ data: { follower_id: "a" }, error: null }), "a", "b")).toBe(true);
  });

  it("is false when there is no row", async () => {
    expect(await isFollowing(followClient({ data: null, error: null }), "a", "b")).toBe(false);
  });

  it("throws on error", async () => {
    await expect(isFollowing(followClient({ data: null, error: new Error("boom") }), "a", "b")).rejects.toThrow("boom");
  });
});

describe("setFollow", () => {
  it("upserts (ignoring duplicates) when following", async () => {
    const upsertSpy = vi.fn(() => Promise.resolve({ error: null }));
    const client = { from: () => ({ upsert: upsertSpy }) } as any;
    await setFollow(client, "a", "b", true);
    expect(upsertSpy).toHaveBeenCalledWith({ follower_id: "a", followee_id: "b" }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  });

  it("deletes the pair when unfollowing", async () => {
    const eq2 = vi.fn(() => Promise.resolve({ error: null }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const client = { from: () => ({ delete: () => ({ eq: eq1 }) }) } as any;
    await setFollow(client, "a", "b", false);
    expect(eq1).toHaveBeenCalledWith("follower_id", "a");
    expect(eq2).toHaveBeenCalledWith("followee_id", "b");
  });

  it("throws on follow error", async () => {
    const client = { from: () => ({ upsert: () => Promise.resolve({ error: new Error("boom") }) }) } as any;
    await expect(setFollow(client, "a", "b", true)).rejects.toThrow("boom");
  });

  it("throws on unfollow error", async () => {
    const client = { from: () => ({ delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: new Error("boom") }) }) }) }) } as any;
    await expect(setFollow(client, "a", "b", false)).rejects.toThrow("boom");
  });
});

describe("updateProfile", () => {
  function updateClient(error: unknown = null) {
    const eqSpy = vi.fn(() => Promise.resolve({ error }));
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    return { client: { from: () => ({ update: updateSpy }) } as any, updateSpy, eqSpy };
  }

  it("updates only the provided fields, trimming and nulling blanks", async () => {
    const { client, updateSpy, eqSpy } = updateClient();
    await updateProfile(client, "u1", { displayName: "  Mara K. ", bio: "   " });
    expect(updateSpy).toHaveBeenCalledWith({ display_name: "Mara K.", bio: null });
    expect(eqSpy).toHaveBeenCalledWith("id", "u1");
  });

  it("leaves untouched fields out of the update", async () => {
    const { client, updateSpy } = updateClient();
    await updateProfile(client, "u1", { bio: "hello" });
    expect(updateSpy).toHaveBeenCalledWith({ bio: "hello" });
  });

  it("does nothing when no fields are given", async () => {
    const { client, updateSpy } = updateClient();
    await updateProfile(client, "u1", {});
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("throws on error", async () => {
    const { client } = updateClient(new Error("boom"));
    await expect(updateProfile(client, "u1", { bio: "x" })).rejects.toThrow("boom");
  });
});

describe("getAdminUserDirectory", () => {
  function fakeDirectoryClient(rows: unknown[]) {
    const builder: any = {
      select: () => builder,
      order: () => builder,
      ilike: () => builder,
      eq: () => builder,
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return { from: () => builder } as any;
  }

  it("maps view rows to AdminUserRow", async () => {
    const client = fakeDirectoryClient([
      {
        id: "u1",
        username: "mara",
        display_name: "Mara K.",
        avatar_url: null,
        is_admin: false,
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        log_count: 12,
        follower_count: 3,
      },
    ]);
    const rows = await getAdminUserDirectory(client);
    expect(rows).toEqual([
      {
        id: "u1",
        username: "mara",
        displayName: "Mara K.",
        avatarUrl: null,
        isAdmin: false,
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        logCount: 12,
        followerCount: 3,
      },
    ]);
  });

  it("throws when the client returns an error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: () => ({ then: (resolve: any) => resolve({ data: null, error: new Error("boom") }) }),
        }),
      }),
    } as any;
    await expect(getAdminUserDirectory(client)).rejects.toThrow("boom");
  });
});

describe("setUserStatus", () => {
  it("calls the admin_set_user_status RPC", async () => {
    const rpcCalls: { fn: string; args: unknown }[] = [];
    const client = {
      rpc: (fn: string, args: unknown) => {
        rpcCalls.push({ fn, args });
        return Promise.resolve({ error: null });
      },
    } as any;
    await setUserStatus(client, "target-1", "suspended");
    expect(rpcCalls).toEqual([{ fn: "admin_set_user_status", args: { p_target_user_id: "target-1", p_status: "suspended" } }]);
  });

  it("throws when the RPC returns an error", async () => {
    const client = { rpc: () => Promise.resolve({ error: new Error("boom") }) } as any;
    await expect(setUserStatus(client, "target-1", "suspended")).rejects.toThrow("boom");
  });
});

describe("setUserAdmin", () => {
  it("calls the admin_set_user_admin RPC", async () => {
    const rpcCalls: { fn: string; args: unknown }[] = [];
    const client = {
      rpc: (fn: string, args: unknown) => {
        rpcCalls.push({ fn, args });
        return Promise.resolve({ error: null });
      },
    } as any;
    await setUserAdmin(client, "target-1", true);
    expect(rpcCalls).toEqual([{ fn: "admin_set_user_admin", args: { p_target_user_id: "target-1", p_is_admin: true } }]);
  });

  it("throws when the RPC returns an error", async () => {
    const client = { rpc: () => Promise.resolve({ error: new Error("boom") }) } as any;
    await expect(setUserAdmin(client, "target-1", true)).rejects.toThrow("boom");
  });
});

describe("createCity", () => {
  it("inserts a city and returns it", async () => {
    const client = {
      from: () => ({
        insert: (payload: unknown) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: "c1", ...(payload as object) }, error: null }),
          }),
        }),
      }),
    } as any;
    const city = await createCity(client, { slug: "lisbon", name: "Lisbon", country: "Portugal", region: "Europe" });
    expect(city).toEqual({ id: "c1", slug: "lisbon", name: "Lisbon", country: "Portugal", region: "Europe" });
  });

  it("throws when the client returns an error", async () => {
    const client = {
      from: () => ({
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error("boom") }) }) }),
      }),
    } as any;
    await expect(createCity(client, { slug: "x", name: "X", country: "X", region: "X" })).rejects.toThrow("boom");
  });
});

describe("updateCity", () => {
  it("updates only the given fields", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => {
          calls.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await updateCity(client, "c1", { status: "live" });
    expect(calls).toEqual([{ status: "live" }]);
  });

  it("omits fields left undefined, even when mixed with defined ones", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => {
          calls.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await updateCity(client, "c1", { name: "Lisbon", status: undefined });
    expect(calls).toEqual([{ name: "Lisbon" }]);
  });
});

describe("createShop", () => {
  it("inserts a shop and returns it", async () => {
    const client = {
      from: () => ({
        insert: (payload: unknown) => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: "s1", ...(payload as object) }, error: null }) }),
        }),
      }),
    } as any;
    const shop = await createShop(client, { name: "Corvo", cityId: "c1", neighborhood: "Alcântara", lat: 38.7, lng: -9.17 });
    expect(shop).toMatchObject({ id: "s1", name: "Corvo" });
  });
});

describe("updateShop", () => {
  it("updates only the given fields", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => {
          calls.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await updateShop(client, "s1", { website: "https://corvo.pt" });
    expect(calls).toEqual([{ website: "https://corvo.pt" }]);
  });
});

describe("upsertShopCuration", () => {
  it("upserts the curation row keyed on shop_id, then clears promotion_status", async () => {
    const calls: unknown[] = [];
    const client = {
      from: (table: string) => ({
        upsert: (payload: unknown) => {
          calls.push({ table, op: "upsert", payload });
          return Promise.resolve({ error: null });
        },
        update: (payload: unknown) => {
          calls.push({ table, op: "update", payload });
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await upsertShopCuration(client, "s1", { priceTier: "€€", tag: "Best pour-over", editorialRating: 5, writeup: "..." });
    expect(calls).toEqual([
      {
        table: "shop_curations",
        op: "upsert",
        payload: { shop_id: "s1", price_tier: "€€", tag: "Best pour-over", editorial_rating: 5, writeup: "...", order_note: undefined },
      },
      { table: "shops", op: "update", payload: { promotion_status: "none" } },
    ]);
  });

  it("throws if clearing promotion_status fails, without swallowing the error", async () => {
    const client = {
      from: (table: string) =>
        table === "shop_curations"
          ? { upsert: () => Promise.resolve({ error: null }) }
          : { update: () => ({ eq: () => Promise.resolve({ error: new Error("boom") }) }) },
    } as any;
    await expect(upsertShopCuration(client, "s1", { priceTier: "€€" })).rejects.toThrow("boom");
  });
});

describe("rejectShopPromotion", () => {
  it("sets promotion_status to rejected", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => {
          calls.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await rejectShopPromotion(client, "s1");
    expect(calls).toEqual([{ promotion_status: "rejected" }]);
  });
});

describe("getAdminShops", () => {
  function fakeShopsClient(rows: unknown[]) {
    const builder: any = {
      select: () => builder,
      order: () => builder,
      ilike: () => builder,
      eq: () => builder,
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return { from: () => builder } as any;
  }

  it("maps rows including nested curation", async () => {
    const client = fakeShopsClient([
      {
        id: "s1",
        name: "Corvo",
        city_id: "c1",
        neighborhood: "Alcântara",
        lat: 38.7,
        lng: -9.17,
        address: null,
        website: null,
        phone: null,
        hours: null,
        promotion_status: "flagged",
        shop_curations: null,
      },
    ]);
    const shops = await getAdminShops(client);
    expect(shops).toEqual([
      {
        id: "s1",
        name: "Corvo",
        cityId: "c1",
        neighborhood: "Alcântara",
        lat: 38.7,
        lng: -9.17,
        address: null,
        website: null,
        phone: null,
        hours: null,
        promotionStatus: "flagged",
        curation: null,
      },
    ]);
  });
});

describe("getAdminCityGuides", () => {
  it("lists city_guide lists with city name and item count", async () => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: () => Promise.resolve({
        data: [
          { id: "l1", slug: "lisbon", title: "Lisbon Guide", city_id: "c1", description: "A guide", body: "Long body", cities: { name: "Lisbon" }, list_items: [{ count: 3 }] },
          { id: "l2", slug: "tampa", title: "Tampa Guide", city_id: "c2", description: null, body: null, cities: null, list_items: [] },
        ],
        error: null,
      }),
    };
    const client = { from: () => builder } as any;
    const guides = await getAdminCityGuides(client);
    expect(guides).toEqual([
      { id: "l1", slug: "lisbon", title: "Lisbon Guide", cityId: "c1", cityName: "Lisbon", itemCount: 3, description: "A guide", body: "Long body" },
      { id: "l2", slug: "tampa", title: "Tampa Guide", cityId: "c2", cityName: "—", itemCount: 0, description: null, body: null },
    ]);
  });
});

describe("createCityGuide", () => {
  it("inserts a list with type city_guide", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        insert: (payload: unknown) => {
          calls.push(payload);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: "l1" }, error: null }) }) };
        },
      }),
    } as any;
    await createCityGuide(client, { slug: "lisbon", title: "Lisbon", cityId: "c1" });
    expect(calls).toEqual([{ type: "city_guide", slug: "lisbon", title: "Lisbon", city_id: "c1", description: undefined, body: undefined, cover_photo_alt: undefined }]);
  });
});

describe("updateCityGuide", () => {
  it("updates only the given fields", async () => {
    const calls: unknown[] = [];
    const client = {
      from: () => ({
        update: (payload: unknown) => {
          calls.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    } as any;
    await updateCityGuide(client, "l1", { title: "New Title" });
    expect(calls).toEqual([{ title: "New Title" }]);
  });
});

describe("getCityGuideItems", () => {
  it("returns ordered items with shop names", async () => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: () => Promise.resolve({
        data: [{ id: "li1", shop_id: "s1", position: 0, note: null, shops: { name: "Corvo" } }],
        error: null,
      }),
    };
    const client = { from: () => builder } as any;
    const items = await getCityGuideItems(client, "l1");
    expect(items).toEqual([{ id: "li1", shopId: "s1", shopName: "Corvo", position: 0, note: null }]);
  });
});

describe("setCityGuideItems", () => {
  it("replaces all items for the list in position order", async () => {
    const calls: { table: string; op: string; payload?: unknown }[] = [];
    const client = {
      from: (table: string) => ({
        delete: () => ({
          eq: () => {
            calls.push({ table, op: "delete" });
            return Promise.resolve({ error: null });
          },
        }),
        insert: (payload: unknown) => {
          calls.push({ table, op: "insert", payload });
          return Promise.resolve({ error: null });
        },
      }),
    } as any;
    await setCityGuideItems(client, "l1", ["s1", "s2"]);
    expect(calls).toEqual([
      { table: "list_items", op: "delete" },
      {
        table: "list_items",
        op: "insert",
        payload: [
          { list_id: "l1", shop_id: "s1", position: 0 },
          { list_id: "l1", shop_id: "s2", position: 1 },
        ],
      },
    ]);
  });

  it("does nothing more after delete when the new list is empty", async () => {
    const calls: { table: string; op: string }[] = [];
    const client = {
      from: (table: string) => ({
        delete: () => ({
          eq: () => {
            calls.push({ table, op: "delete" });
            return Promise.resolve({ error: null });
          },
        }),
        insert: () => {
          calls.push({ table, op: "insert" });
          return Promise.resolve({ error: null });
        },
      }),
    } as any;
    await setCityGuideItems(client, "l1", []);
    expect(calls).toEqual([{ table: "list_items", op: "delete" }]);
  });
});

describe("searchRatedShops", () => {
  function recordingClient() {
    const ilikes: [string, string][] = [];
    const builder: any = {
      ilike: (col: string, pattern: string) => { ilikes.push([col, pattern]); return builder; },
      not: () => builder,
      order: () => builder,
      limit: () => Promise.resolve({ data: [{ id: "s1", name: "Dancing Goats Coffee" }], error: null }),
    };
    return { ilikes, client: { from: () => ({ select: () => builder }) } as any };
  }

  it("matches every word, in any order", async () => {
    const { ilikes, client } = recordingClient();
    const rows = await searchRatedShops(client, "  goats   dancing ");
    expect(ilikes).toEqual([["name", "%goats%"], ["name", "%dancing%"]]);
    expect(rows).toEqual([{ id: "s1", name: "Dancing Goats Coffee" }]);
  });

  it("strips wildcard characters and skips too-short queries", async () => {
    const { ilikes, client } = recordingClient();
    await searchRatedShops(client, "50%_off\\");
    expect(ilikes).toEqual([["name", "%50off%"]]);
    expect(await searchRatedShops(recordingClient().client, "a")).toEqual([]);
  });
});
