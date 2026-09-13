import { useEffect, useRef, useState } from "react";

/** Anima un número desde su valor anterior hasta `target` (ease-out cúbico). */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      from.current = target;
      setValue(target);
      return;
    }

    const start = performance.now();
    const origin = from.current;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = origin + (target - origin) * eased;
      from.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
