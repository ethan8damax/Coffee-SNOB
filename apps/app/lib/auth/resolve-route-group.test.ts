import { describe, it, expect } from "vitest";
import { resolveRouteGroup } from "./resolve-route-group";

describe("resolveRouteGroup", () => {
  it("sends an unauthenticated user to (auth)", () => {
    expect(resolveRouteGroup({ hasSession: false, isRecoveryRoute: false, onboarded: false })).toBe(
      "(auth)"
    );
  });

  it("sends a password-recovery deep link to reset-password even with no session yet", () => {
    expect(resolveRouteGroup({ hasSession: false, isRecoveryRoute: true, onboarded: false })).toBe(
      "reset-password"
    );
  });

  it("sends a password-recovery deep link to reset-password even for an onboarded, signed-in user", () => {
    expect(resolveRouteGroup({ hasSession: true, isRecoveryRoute: true, onboarded: true })).toBe(
      "reset-password"
    );
  });

  it("sends a signed-in, un-onboarded user to (onboarding)", () => {
    expect(resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, onboarded: false })).toBe(
      "(onboarding)"
    );
  });

  it("sends a signed-in, onboarded user to (tabs)", () => {
    expect(resolveRouteGroup({ hasSession: true, isRecoveryRoute: false, onboarded: true })).toBe(
      "(tabs)"
    );
  });
});
