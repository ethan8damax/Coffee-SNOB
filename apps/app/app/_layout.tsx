import { useEffect } from "react";
import { Stack, SplashScreen, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import { AuthProvider, useAuth } from "@/context/auth";
import { resolveRouteGroup } from "@/lib/auth/resolve-route-group";

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { session, profile, loading } = useAuth();
  const pathname = usePathname();
  const ready = fontsLoaded && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  const group = resolveRouteGroup({
    hasSession: !!session,
    isRecoveryRoute: pathname === "/reset-password",
    onboarded: !!profile?.onboarded_at,
  });

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={group === "(auth)"}>
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
  const [fontsLoaded] = useFonts({
    "Area-Regular": require("../assets/fonts/area-normal/fonnts.com-Area_Normal_Regular.otf"),
    "Area-Bold": require("../assets/fonts/area-normal/fonnts.com-Area_Normal_Bold.otf"),
    "AreaExtended-Bold": require("../assets/fonts/area-normal/fonnts.com-Area_Extended_Bold.otf"),
    "AreaExtended-Black": require("../assets/fonts/area-normal/fonnts.com-Area_Extended_Black.otf"),
  });

  return (
    <AuthProvider>
      <RootNavigator fontsLoaded={fontsLoaded} />
    </AuthProvider>
  );
}
