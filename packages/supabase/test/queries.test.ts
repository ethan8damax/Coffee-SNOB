import { describe, it, expect, vi } from "vitest";
import { getCities, getCityGuide } from "../src/queries";

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
    const guide = { id: "g1", slug: "lisbon-guide", title: "Lisbon Guide" };
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
