import { useEffect } from "react";
import { isAnimatedPath } from "../lib/paths";

// How long to wait after the last change before converting again
export const LIVE_PREVIEW_DELAY_MS = 250;

/**
 * Re-converts shortly after any change to the image or the options.
 * GIFs and background removal are too slow for that and stay manual.
 */
export function useLivePreview({ enabled, path, options, convert }) {
  useEffect(() => {
    if (!enabled || !path) return undefined;
    if (isAnimatedPath(path) || options.removeBackground) return undefined;

    const timer = setTimeout(
      () => convert(path, options, { preview: true }),
      LIVE_PREVIEW_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [enabled, path, options, convert]);
}
