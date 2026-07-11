/**
 * Device-class hook for the three UI tiers:
 *   phone   < 700px  — bottom-tab shell, card lists, full-screen detail sheet
 *   tablet  700–1099 — top-tab shell, 2-column grids, side detail panel
 *   desktop ≥ 1100   — the full dense desktop UI (unchanged)
 *
 * The desktop experience is authoritative (design_handoff spec); phone/tablet
 * serve a curated subset of features (see mobile/MobileApp.tsx).
 */
import { useEffect, useState } from 'react';

export type Viewport = 'phone' | 'tablet' | 'desktop';

const classify = (): Viewport =>
  typeof window === 'undefined' || window.innerWidth >= 1100
    ? 'desktop'
    : window.innerWidth >= 700
      ? 'tablet'
      : 'phone';

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(classify);
  useEffect(() => {
    const onResize = () => setVp(classify());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}
