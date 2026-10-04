import { useCallback, useState } from "react";
import { parseStopCode } from "@/lib/stop-link.ts";

/**
 * A stop link (/stop/3) names the stop to open once the guest has a language and a saved pack. The
 * number is read once at start-up; `clear` forgets it and returns the address bar to "/" so a
 * reload does not open the stop again.
 */
export function useStopLink(): [number | null, () => void] {
  const [stop, setStop] = useState<number | null>(() => parseStopCode(window.location.pathname));
  const clear = useCallback(() => {
    setStop(null);
    if (window.location.pathname !== "/") window.history.replaceState(null, "", "/");
  }, []);
  return [stop, clear];
}
