import { useLocalSearchParams, router } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { AddShopForm } from "@/components/add-shop/add-shop-form";

// Step two of Add a shop: the pin is down (map pin mode), now the details.
export default function AddShopScreen() {
  const { session } = useAuth();
  const { name, lat, lng } = useLocalSearchParams<{ name?: string; lat?: string; lng?: string }>();
  const at = { lat: Number(lat), lng: Number(lng) };
  const placed = lat != null && lng != null && Number.isFinite(at.lat) && Number.isFinite(at.lng);

  // No pin (a bare /add-shop link): go drop one first.
  useEffect(() => {
    if (session && !placed) router.replace({ pathname: "/map", params: { add: name || "1" } });
  }, [session, placed, name]);

  if (!session) return <SignInPrompt message="Sign in to add a shop." />;
  if (!placed) return null;
  // Key on the spot so moving the pin starts a fresh form.
  return <AddShopForm key={`${lat},${lng}`} initialName={name ?? ""} lat={at.lat} lng={at.lng} />;
}
