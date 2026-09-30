import { getMyMessages, getMyReports, getMySubmissions } from "@coffeesnob/supabase";
import { useLoad } from "../profile/use-extras";

// Shops, reports, and messages a person sent, loaded together.
export const useSent = (userId: string) =>
  useLoad(
    async (s) => {
      const [shops, reports, messages] = await Promise.all([getMySubmissions(s, userId), getMyReports(s, userId), getMyMessages(s, userId)]);
      return { shops, reports, messages };
    },
    [userId],
  );
