import { getMySubmissions, type ShopSubmission } from "@coffeesnob/supabase";
import { useLoad } from "../profile/use-extras";

export const useMySubmissions = (userId: string) => useLoad<ShopSubmission[]>((s) => getMySubmissions(s as never, userId), [userId]);
