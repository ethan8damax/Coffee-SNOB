import { describe, it, expect } from "vitest";
import { colors } from "../src/colors";

const REQUIRED_KEYS = [
  "sage", "sageDk", "sageLt", "oxblood", "oxbloodLt", "burnt",
  "teal", "tealDk", "cream", "paper", "paper2", "card", "ink", "ink2", "ink3",
] as const;

describe("colors", () => {
  it("defines every required brand color", () => {
    for (const key of REQUIRED_KEYS) {
      expect(colors[key]).toBeDefined();
    }
  });

  it("defines solid colors as 6-digit hex", () => {
    for (const key of REQUIRED_KEYS) {
      expect(colors[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
