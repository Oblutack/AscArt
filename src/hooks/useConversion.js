import { useCallback, useEffect, useRef, useState } from "react";
import { ascart } from "../ascart";
import { isGifPath } from "../lib/paths";

const NO_FRAMES = [];
const EMPTY_ART = {
  ascii: "",
  isGif: false,
  frames: NO_FRAMES,
  delays: NO_FRAMES,
};

/**
 * Runs conversions in the Python backend and keeps the result.
 *
 * Every conversion gets a request id and only the latest one counts, so an
 * answer that arrives after Stop (or after a newer conversion) is ignored.
 */
export function useConversion({ showToast }) {
  const [art, setArt] = useState(EMPTY_ART);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(null);

  // The conversion we are waiting for, if any
  const activeRequest = useRef(null);
  const requestCounter = useRef(0);

  useEffect(() => {
    const handleResponse = (data) => {
      const isStale =
        data.requestId !== undefined &&
        data.requestId !== activeRequest.current;

      if (data.type === "progress") {
        if (!isStale) setProgress({ current: data.current, total: data.total });
      } else if (data.type === "ascii-result") {
        if (isStale) return;
        activeRequest.current = null;
        setArt({ ...EMPTY_ART, ascii: data.ascii });
        setIsLoading(false);
        setProgress(null);
      } else if (data.type === "gif-result") {
        if (isStale) return;
        activeRequest.current = null;
        const frames = data.frames || NO_FRAMES;
        setArt({
          ascii: frames[0] || "",
          isGif: true,
          frames,
          delays: data.delays || NO_FRAMES,
        });
        setIsLoading(false);
        setProgress(null);
      } else if (data.type === "stopped") {
        setIsLoading(false);
        setProgress(null);
        showToast("Conversion stopped", "info");
      } else if (data.status === "error") {
        if (isStale) return;
        console.error("Python error:", data.error);
        activeRequest.current = null;
        setIsLoading(false);
        setProgress(null);
        showToast(data.error, "error");
      }
    };

    return ascart.onResponse(handleResponse);
  }, [showToast]);

  // A deliberate conversion shows the spinner and lands in History. A live
  // preview does neither: the old art stays up until the new one arrives.
  const start = useCallback(
    (path, options, { preview = false } = {}) => {
      if (!path) return;

      if (!preview && options.removeBackground && isGifPath(path)) {
        showToast(
          "Background removal on a GIF runs per frame and can take a while",
          "info",
        );
      }

      const requestId = ++requestCounter.current;
      activeRequest.current = requestId;
      setProgress(null);
      setIsLoading(!preview);

      ascart.convert(requestId, path, options, !preview);
    },
    [showToast],
  );

  const stop = useCallback(() => {
    const requestId = activeRequest.current;
    activeRequest.current = null; // anything that still arrives for it is ignored
    setIsLoading(false);
    setProgress(null);
    ascart.stop(requestId);
  }, []);

  // Show art that didn't come from a conversion (an entry from History)
  const showArt = useCallback(
    (ascii, { isGif = false, frames, delays } = {}) => {
      if (isGif && frames && delays) {
        setArt({ ascii: frames[0] || ascii, isGif: true, frames, delays });
      } else {
        setArt({ ...EMPTY_ART, ascii });
      }
    },
    [],
  );

  return { art, isLoading, progress, start, stop, showArt };
}
