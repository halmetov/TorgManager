import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const getIsMobile = () => (typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false);
  const [isMobile, setIsMobile] = React.useState<boolean>(getIsMobile());

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Sync once in case of hydration mismatch
    setIsMobile(mql.matches);
    mql.addEventListener?.("change", onChange);
    // Fallback for older browsers
    // @ts-ignore
    mql.addListener?.(onChange);
    return () => {
      mql.removeEventListener?.("change", onChange);
      // @ts-ignore
      mql.removeListener?.(onChange);
    };
  }, []);

  return isMobile;
}
