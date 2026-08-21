import { describe, it, expect, vi } from "vitest";
import { getCities } from "../src/queries";

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
