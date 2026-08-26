import { useEffect, useRef, useState } from "react";

/**
 * Audit G6: app-wide polite live region. Mount once (router shell), then
 * call `announce(message)` from anywhere to make status changes (connection
 * test results, saves, streaming milestones) perceivable to assistive tech.
 */
let pushAnnouncement: ((message: string) => void) | undefined;

export const announce = (message: string): void => {
  pushAnnouncement?.(message);
};

export function AppAriaLiveRegion() {
  const [message, setMessage] = useState("");
  const counter = useRef(0);

  useEffect(() => {
    pushAnnouncement = (next: string) => {
      counter.current += 1;
      // Appending a counter forces re-announcement of identical messages.
      setMessage(`${next}\u200e${"\u00ad".repeat(counter.current % 2)}`);
    };
    return () => {
      pushAnnouncement = undefined;
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
