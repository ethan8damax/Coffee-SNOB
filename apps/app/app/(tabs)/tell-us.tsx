import { useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/auth";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { TellUsForm, type ShopRef, type Topic } from "@/components/tell-us/tell-us-form";

const TOPICS: Topic[] = ["shop", "bug", "idea", "contact"];

// Tell us: /tell-us?about=bug, or a shop report with the shop filled in:
// /tell-us?about=shop&shopId=… (or placeId=cs_…)&name=…&lat=…&lng=…
export default function TellUsScreen() {
  const { session } = useAuth();
  const p = useLocalSearchParams<{ about?: string; shopId?: string; placeId?: string; name?: string; lat?: string; lng?: string; from?: string }>();
  if (!session) return <SignInPrompt message="Sign in to tell us." />;
  const topic = TOPICS.includes(p.about as Topic) ? (p.about as Topic) : null;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const shop: ShopRef | null =
    p.name && Number.isFinite(lat) && Number.isFinite(lng) && (p.shopId || p.placeId)
      ? { ...(p.shopId ? { shopId: p.shopId } : { placeId: p.placeId! }), name: p.name, lat, lng }
      : null;
  return <TellUsForm key={`${topic}:${p.shopId ?? p.placeId ?? ""}`} topic={topic} shop={shop} from={p.from ?? "/tell-us"} />;
}
