export const DESKTOP_MIN_WIDTH = 1024;

export type NavRoute = "index" | "map" | "log" | "profile";

export type NavItem = {
  route: NavRoute;
  path: string;
  label: string;
  icon: "home" | "map" | "plus" | "user";
  // The Log destination is the burnt "+" action, not a regular tab.
  isAction: boolean;
};

// Order and labels follow the design's TabBar (screens/home.jsx). The design's
// "Lists" tab is omitted for v1 — collections ship after launch.
export const NAV_ITEMS: NavItem[] = [
  { route: "index", path: "/", label: "Feed", icon: "home", isAction: false },
  { route: "map", path: "/map", label: "Map", icon: "map", isAction: false },
  { route: "log", path: "/log", label: "Log a visit", icon: "plus", isAction: true },
  { route: "profile", path: "/profile", label: "You", icon: "user", isAction: false },
];

export function isDesktopWidth(width: number): boolean {
  return width >= DESKTOP_MIN_WIDTH;
}

export function isNavRoute(name: string): name is NavRoute {
  return NAV_ITEMS.some((i) => i.route === name);
}

export function routeForPath(pathname: string): NavRoute | null {
  return NAV_ITEMS.find((i) => i.path === pathname)?.route ?? null;
}
