import { useEffect } from "react";
import { Stack, SplashScreen, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import { AuthProvider, useAuth } from "@/context/auth";
import { resolveRouteGroup, isPublicTabPath } from "@/lib/auth/resolve-route-group";

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { session, profile, loading } = useAuth();
  const pathname = usePathname();
  const ready = fontsLoaded && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  const isRecoveryRoute = pathname === "/reset-password";
  const group = resolveRouteGroup({
    hasSession: !!session,
    isRecoveryRoute,
    isPublicTabRoute: isPublicTabPath(pathname),
    onboarded: !!profile?.onboarded_at,
  });
  // (auth) must stay reachable via router.push from a public tab even though
  // `group` (driven by the current pathname) says we're in "(tabs)" right now —
  // otherwise Stack.Protected never registers the sign-in route to navigate to.
  const authReachable = !session && !isRecoveryRoute;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={authReachable}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={group === "reset-password"}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={group === "(onboarding)"}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={group === "(tabs)"}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Area-Regular": require("../assets/fonts/area-normal/fonnts.com-Area_Normal_Regular.otf"),
    "Area-Bold": require("../assets/fonts/area-normal/fonnts.com-Area_Normal_Bold.otf"),
    "AreaExtended-Bold": require("../assets/fonts/area-normal/fonnts.com-Area_Extended_Bold.otf"),
    "AreaExtended-Black": require("../assets/fonts/area-normal/fonnts.com-Area_Extended_Black.otf"),
  });

  useEffect(() => {
    if (fontError) console.error("Failed to load Area typeface:", fontError);
  }, [fontError]);

  return (
    <AuthProvider>
      <RootNavigator fontsLoaded={fontsLoaded || !!fontError} />
    </AuthProvider>
  );
}
