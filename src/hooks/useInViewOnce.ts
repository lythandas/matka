// src/hooks/useInViewOnce.ts
import * as React from "react";

/**
 * `[ref, inView]`: observes the element attached to `ref`; `inView` flips to
 * true (once, permanently) when it comes within `rootMargin` of the viewport,
 * and stays false while `IntersectionObserver` is unavailable (callers treat
 * that as "never near" — they simply keep their lazy default behaviour).
 *
 * Same gating contract as PostMediaFrame's built-in observer; extracted as a
 * hook for cards that do not render a PostMediaFrame (GridPostCard).
 */
export function useInViewOnce<T extends Element>(
  rootMargin = "300px",
): [React.RefObject<T>, boolean] {
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}
