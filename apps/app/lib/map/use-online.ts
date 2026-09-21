import { useEffect, useState } from "react";

// ponytail: browser online/offline events only (v1 is web). On native this stays
// `true` — the native app will need its own connectivity source.
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(typeof navigator === "undefined" || navigator.onLine !== false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
