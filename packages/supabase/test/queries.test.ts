import { describe, it, expect, vi } from "vitest";
import { getCities, getCitiesWithShopCounts, getCityGuide, getProfile, isUsernameAvailable, saveIdentity, saveTastePicks, getRatedShopsInBounds, logShopVisit, getProfilesByIds, getCitiesByIds, getLogLikes, setLogLike } from "../src/queries";

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
    expect(selectSpy).toHaveBeenCalledWith("id, name, lat, lng, neighborhood, is_snob_approved, tag, price_tier, rating, log_count");
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
