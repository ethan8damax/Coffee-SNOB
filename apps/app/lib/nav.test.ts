import { describe, it, expect } from "vitest";
import { NAV_ITEMS, DESKTOP_MIN_WIDTH, isDesktopWidth, isNavRoute, routeForPath } from "./nav";

describe("nav", () => {
  it("lists the v1 destinations in design order, with Map accented", () => {
    expect(NAV_ITEMS.map((i) => i.route)).toEqual(["index", "map", "profile"]);
    expect(NAV_ITEMS.filter((i) => i.accent).map((i) => i.route)).toEqual(["map"]);
  });

  it("switches to the desktop shell at exactly 1024px", () => {
    expect(DESKTOP_MIN_WIDTH).toBe(1024);
    expect(isDesktopWidth(1023)).toBe(false);
    expect(isDesktopWidth(1024)).toBe(true);
  });

  it("recognises nav routes and hides the retired lists tab", () => {
    expect(isNavRoute("map")).toBe(true);
    expect(isNavRoute("lists")).toBe(false);
  });

  it("maps pathnames to routes", () => {
    expect(routeForPath("/")).toBe("index");
    expect(routeForPath("/map")).toBe("map");
    expect(routeForPath("/profile")).toBe("profile");
    expect(routeForPath("/somewhere-else")).toBeNull();
  });

  it("highlights Map on shop pages and You on profile pages", () => {
    expect(routeForPath("/shop/abc-123")).toBe("map");
    expect(routeForPath("/city/atlanta-georgia-us")).toBe("map");
    expect(routeForPath("/u/mara")).toBe("profile");
  });
});
