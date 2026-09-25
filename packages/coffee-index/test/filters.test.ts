import { describe, it, expect } from "vitest";
import { isChain, normalizeChainName, isCoffeePlace } from "../src";

describe("isCoffeePlace", () => {
  it("keeps cafés and coffee-serving restaurants", () => {
    expect(isCoffeePlace({ name: "Spiller Park Coffee", amenity: "cafe" })).toBe(true);
    expect(isCoffeePlace({ name: "Muchacho", amenity: "restaurant", cuisine: "mexican;coffee_shop" })).toBe(true);
    expect(isCoffeePlace({ name: "Tea Bar", amenity: "cafe", cuisine: "tea;coffee_shop" })).toBe(true);
  });

  it("drops bubble tea, tea-only cafés, and cafeterias", () => {
    expect(isCoffeePlace({ name: "Kung Fu Tea", amenity: "cafe", cuisine: "bubble_tea" })).toBe(false);
    expect(isCoffeePlace({ name: "Queen Tea", amenity: "cafe", cuisine: "tea" })).toBe(false);
    expect(isCoffeePlace({ name: "Piedmont North Dining Hall", amenity: "cafe" })).toBe(false);
    expect(isCoffeePlace({ name: "One Georgia Center Cafeteria", amenity: "cafe" })).toBe(false);
    // Real Atlanta cases: tea shops tagged with a mixed cuisine, or not tagged at all.
    expect(isCoffeePlace({ name: "Tea Leaf and Creamery", amenity: "cafe", cuisine: "bubble_tea;ice_cream" })).toBe(false);
    expect(isCoffeePlace({ name: "Queen Tea", amenity: "cafe" })).toBe(false);
    expect(isCoffeePlace({ name: "Boba Mocha", amenity: "cafe" })).toBe(false);
    expect(isCoffeePlace({ name: "Landmark Diner - Downtown", amenity: "cafe" })).toBe(false);
  });

  it("keeps coffee places that mention tea, and words that only contain 'tea'", () => {
    expect(isCoffeePlace({ name: "Marlee's Coffee and Tea", amenity: "cafe" })).toBe(true);
    expect(isCoffeePlace({ name: "Café Tea House", amenity: "cafe" })).toBe(true);
    expect(isCoffeePlace({ name: "Teaspoon Roasters", amenity: "cafe" })).toBe(true);
    expect(isCoffeePlace({ name: "Steady Espresso & Tea", amenity: "cafe" })).toBe(true);
    expect(isCoffeePlace({ name: "Leaf", amenity: "cafe", cuisine: "coffee;tea" })).toBe(true);
    expect(isCoffeePlace({ name: "Tea & Caffè", amenity: "cafe" })).toBe(true);
    expect(isCoffeePlace({ name: "The Coffee Diner", amenity: "cafe" })).toBe(true);
  });
});

describe("isChain", () => {
  const chains = [
    { name: "starbucks", wikidata: "Q37158" },
    { name: "dunkin", wikidata: null },
    { name: "caribou coffee", wikidata: null },
    { name: "costa coffee", wikidata: "Q608845" },
  ];

  it("matches names regardless of case, apostrophes, and trailing words", () => {
    expect(isChain({ name: "Starbucks" }, chains)).toBe(true);
    expect(isChain({ name: "Dunkin' Donuts" }, chains)).toBe(true);
    expect(isChain({ name: "Dunkin Donuts Express" }, chains)).toBe(true);
  });

  it("matches on the brand tag when the name is a location", () => {
    expect(isChain({ name: "Midtown Plaza", brand: "Caribou Coffee" }, chains)).toBe(true);
  });

  it("matches the brand ID in any language", () => {
    expect(isChain({ name: "スターバックス", "brand:wikidata": "Q37158" }, chains)).toBe(true);
    expect(isChain({ name: "Costa", brand: "Costa", "brand:wikidata": "Q608845" }, chains)).toBe(true);
    expect(isChain({ name: "X", "brand:wikidata": "Q1;Q37158" }, chains)).toBe(true);
  });

  it("matches the English name/brand tags", () => {
    expect(isChain({ name: "スターバックス", "brand:en": "Starbucks" }, chains)).toBe(true);
  });

  it("only matches whole words from the start", () => {
    expect(isChain({ name: "Starbucksy Roasters" }, chains)).toBe(false);
    expect(isChain({ name: "Not Starbucks" }, chains)).toBe(false);
    expect(isChain({ name: "Costa Rica Café" }, chains)).toBe(false);
    // ID-backed entries match names exactly, so a short chain name can't swallow local shops.
    expect(isChain({ name: "Costa Rica Café" }, [{ name: "costa", wikidata: "Q608845" }])).toBe(false);
    expect(isChain({ name: "Costa" }, [{ name: "costa", wikidata: "Q608845" }])).toBe(true);
    expect(isChain({ name: "WatchHouse", "brand:wikidata": "Q121339538" }, chains)).toBe(false);
  });

  it("normalizes entries the same way as names", () => {
    expect(normalizeChainName("Peet's Coffee")).toBe("peets coffee");
    expect(normalizeChainName("The Coffee Bean & Tea Leaf")).toBe("the coffee bean tea leaf");
    expect(normalizeChainName("McCafé")).toBe("mccafe");
    // Other scripts keep their letters; only spaces and punctuation separate words.
    expect(normalizeChainName("スターバックス・南京")).toBe("スターバックス 南京");
    expect(normalizeChainName("กอกล้วย Coffee")).toBe("กอกล้วย coffee");
    expect(normalizeChainName("Кофе Лайк!")).toBe("кофе лайк");
  });
});
