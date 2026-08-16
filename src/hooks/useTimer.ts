import { useEffect, useRef, useState } from 'react';

/**
 * A wall-clock timer that survives tab backgrounding.
 *
 * Counting `setInterval` ticks would drift and, worse, would silently stop when the
 * browser throttles a background tab — turning a 20-minute timed section into however
 * long the user left the tab open. Timestamps are the only honest way to time a section.
 */
export function useTimer(running: boolean): { elapsedSec: number; reset: () => void } {
  const startRef = useRef<number>(Date.now());
  const accumulatedRef = useRef(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!running) {
      accumulatedRef.current += Date.now() - startRef.current;
      return;
    }
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsedSec(Math.floor((accumulatedRef.current + Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  return {
    elapsedSec,
    reset: () => {
      accumulatedRef.current = 0;
      startRef.current = Date.now();
      setElapsedSec(0);
    },
  };
}

/** Counts down from a fixed budget and reports when it runs out. */
export function useCountdown(totalSec: number, running: boolean) {
  const { elapsedSec, reset } = useTimer(running);
  const remainingSec = Math.max(0, totalSec - elapsedSec);
  return { remainingSec, elapsedSec, expired: remainingSec === 0, reset };
}
