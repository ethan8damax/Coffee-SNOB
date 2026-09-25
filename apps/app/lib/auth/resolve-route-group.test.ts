import { describe, it, expect } from "vitest";
import { resolveRouteGroup, isPublicTabPath } from "./resolve-route-group";

describe("resolveRouteGroup", () => {
  it("sends an unauthenticated user to (auth)", () => {
    expect(
      resolveRouteGroup({ hasSession: false, isRecoveryRoute: false, isPublicTabRoute: false, onboarded: false })
    ).toBe("(auth)");
  });

  it("sends a password-recovery deep link to reset-password even with no session yet", () => {
    expect(
      resolveRouteGroup({ hasSession: false, isRecoveryRoute: true, isPublicTabRoute: false, onboarded: false })
    ).toBe("reset-password");
  });

  it("sends a password-recovery deep link to reset-password even for an onboarded, signed-in user", () => {
    expect(
      resolveRouteGroup({ hasSession: true, isRecoveryRoute: true, isPublicTabRoute: false, onboarded: true })
    ).toBe("reset-password");
  });

  it("sends a signed-in, un-onboarded user to (onboarding)", () => {
    expect(
      resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, isPublicTabRoute: false, onboarded: false })
    ).toBe("(onboarding)");
  });

  it("sends a signed-in, onboarded user to (tabs)", () => {
    expect(
      resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, isPublicTabRoute: false, onboarded: true })
    ).toBe("(tabs)");
  });

  it("sends an unauthenticated user on a public tab route to (tabs) instead of (auth)", () => {
    expect(
      resolveRouteGroup({ hasSession: false, isRecoveryRoute: false, isPublicTabRoute: true, onboarded: false })
    ).toBe("(tabs)");
  });

  it("still prioritizes reset-password over a public tab route", () => {
    expect(
      resolveRouteGroup({ hasSession: false, isRecoveryRoute: true, isPublicTabRoute: true, onboarded: false })
    ).toBe("reset-password");
  });

  it("has no effect once there's a session (isPublicTabRoute is only consulted when there's no session)", () => {
    expect(
      resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, isPublicTabRoute: true, onboarded: true })
    ).toBe("(tabs)");
  });
});

describe("isPublicTabPath", () => {
  it("treats every tab route as public", () => {
    expect(isPublicTabPath("/")).toBe(true);
    expect(isPublicTabPath("/map")).toBe(true);
    expect(isPublicTabPath("/city/atlanta-georgia-us")).toBe(true);
    expect(isPublicTabPath("/log")).toBe(true);
    expect(isPublicTabPath("/lists")).toBe(true);
    expect(isPublicTabPath("/profile")).toBe(true);
  });

  it("treats non-tab routes as not public", () => {
    expect(isPublicTabPath("/sign-in")).toBe(false);
    expect(isPublicTabPath("/reset-password")).toBe(false);
  });
});

describe("isPublicTabPath — detail pages", () => {
  it("treats shop and profile detail pages as public so anonymous visitors can open them", () => {
    expect(isPublicTabPath("/shop/abc-123")).toBe(true);
    expect(isPublicTabPath("/u/mara")).toBe(true);
    expect(isPublicTabPath("/people")).toBe(true);
  });

  it("does not treat lookalike prefixes as public", () => {
    expect(isPublicTabPath("/shopping")).toBe(false);
    expect(isPublicTabPath("/user/mara")).toBe(false);
  });
});
