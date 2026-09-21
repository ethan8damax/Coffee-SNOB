import { useLocalSearchParams } from "expo-router";
import { ProfileView } from "@/components/profile/profile-view";
import { useAuth } from "@/context/auth";

// Public: signed-out visitors can view. If the username is the signed-in
// user's own, ProfileView detects that via viewerId and renders it as own.
export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { session } = useAuth();
  return <ProfileView username={String(username ?? "")} viewerId={session?.user.id ?? null} />;
}
