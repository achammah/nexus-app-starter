import * as React from "react";
import { api } from "./api";

/* Live-sync seam: poll the object's revision counter and fire onChange when
   ANOTHER writer bumped it. The event SHAPE (one "room" per object, a change
   signal, refetch as the reducer) is transport-agnostic — SSE can replace the
   interval later without touching consumers. Pauses while the tab is hidden. */

export function usePollRev(objectKey: string, onChange: () => void, intervalMs = 4000) {
  const revRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    revRef.current = null;
    let stopped = false;
    const tick = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const { rev } = await api.rev(objectKey);
        if (revRef.current !== null && rev !== revRef.current) onChange();
        revRef.current = rev;
      } catch {
        /* transient — next tick retries */
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [objectKey, onChange, intervalMs]);
}
