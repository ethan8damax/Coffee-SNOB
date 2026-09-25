export const DESKTOP_MIN_WIDTH = 1024;

export type NavRoute = "index" | "map" | "profile";

export type NavItem = {
  route: NavRoute;
  path: string;
  label: string;
  icon: "home" | "map" | "user";
  // Map is the wayfinding tab, so it keeps the burnt accent the old "Log a visit"
  // action button used, even though it's a regular tab (not an action).
  accent: boolean;
};

// Order and labels follow the design's TabBar (screens/home.jsx). The design's
// "Lists" tab is omitted for v1 — collections ship after launch. Log a visit was
// dropped as its own nav item; it's reached from the map, a shop page, or a preview
// card instead. The /log route itself is unchanged.
export const NAV_ITEMS: NavItem[] = [
  { route: "index", path: "/", label: "Feed", icon: "home", accent: false },
  { route: "map", path: "/map", label: "Map", icon: "map", accent: true },
  { route: "profile", path: "/profile", label: "You", icon: "user", accent: false },
];

export function isDesktopWidth(width: number): boolean {
  return width >= DESKTOP_MIN_WIDTH;
}

export function isNavRoute(name: string): name is NavRoute {
  return NAV_ITEMS.some((i) => i.route === name);
}

// Detail pages nested under a tab keep that tab highlighted (shop pages live
// and city pages live under Map, other people's profiles under You).
const PATH_PREFIX_ROUTES: { prefix: string; route: NavRoute }[] = [
  { prefix: "/shop/", route: "map" },
  { prefix: "/city/", route: "map" },
  { prefix: "/u/", route: "profile" },
  { prefix: "/people", route: "profile" },
];

export function routeForPath(pathname: string): NavRoute | null {
  const exact = NAV_ITEMS.find((i) => i.path === pathname);
  if (exact) return exact.route;
  return PATH_PREFIX_ROUTES.find((p) => pathname.startsWith(p.prefix))?.route ?? null;
}
