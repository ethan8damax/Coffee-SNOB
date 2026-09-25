import { useEffect, useState } from "react";
import { getActivePlaceHides } from "@coffeesnob/supabase";

// Coffee index places hidden since the monthly build: admin hides and places
// two people reported closed. Fetched once per session; a failure just means
// nothing extra is hidden.
let request: Promise<Set<string>> | null = null;
function loadPlaceHides(): Promise<Set<string>> {
  if (!request) {
    const { supabase } = require("../supabase");
    request = getActivePlaceHides(supabase).then(
      (ids) => new Set(ids),
      () => {
        request = null;
        return new Set<string>();
      },
    );
  }
  return request;
}

export function usePlaceHides(enabled: boolean): Set<string> {
  const [hides, setHides] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadPlaceHides().then((h) => !cancelled && setHides(h));
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return hides;
}
