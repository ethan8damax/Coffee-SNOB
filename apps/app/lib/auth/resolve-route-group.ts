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

export function isPublicTabPath(pathname: string): boolean {
  return PUBLIC_TAB_PATHS.includes(pathname);
}
