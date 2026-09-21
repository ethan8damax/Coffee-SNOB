export type RouteGroup = "(auth)" | "reset-password" | "(onboarding)" | "(tabs)";

export function resolveRouteGroup(params: {
  hasSession: boolean;
  isRecoveryRoute: boolean;
  isPublicTabRoute: boolean;
  onboarded: boolean;
}): RouteGroup {
  if (params.isRecoveryRoute) return "reset-password";
  if (!params.hasSession) return params.isPublicTabRoute ? "(tabs)" : "(auth)";
  return params.onboarded ? "(tabs)" : "(onboarding)";
}

export const PUBLIC_TAB_PATHS = ["/", "/map", "/log", "/lists", "/profile"];

// Detail pages that live inside (tabs) so they keep the tab bar / rail.
export const PUBLIC_TAB_PREFIXES = ["/shop/", "/u/"];

export function isPublicTabPath(pathname: string): boolean {
  return PUBLIC_TAB_PATHS.includes(pathname) || PUBLIC_TAB_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
