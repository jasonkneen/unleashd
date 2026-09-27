import { useCallback, useEffect, useRef, useState } from 'react';

const SCROLL_IDLE_MS = 700;

/** Pair with the `ui-scroll-quiet` primitive: spread onto the scroll container so its
 *  thumb shows only while the list is scrolling and fades out once it goes idle. */
export function useScrollActivity() {
  const [scrolling, setScrolling] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (idle.current) clearTimeout(idle.current);
    },
    []
  );

  const onScroll = useCallback(() => {
    setScrolling(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setScrolling(false), SCROLL_IDLE_MS);
  }, []);

  return { 'data-scrolling': scrolling || undefined, onScroll };
}
