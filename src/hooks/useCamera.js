import { useCallback, useEffect, useRef, useState } from "react";

// How many pictures a second are sent for conversion. The backend does one at
// a time and busy moments just drop frames, so this is a ceiling.
export const CAMERA_FPS = 6;

// Frames are shrunk before sending: the art is at most 300 characters wide
const CAPTURE_WIDTH = 480;
const JPEG_QUALITY = 0.7;

/** @param {unknown} error */
export function cameraErrorMessage(error) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was refused";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The camera is being used by another program";
  }
  return `The camera is not available: ${error instanceof Error ? error.message : error}`;
}

/**
 * The webcam as a source of pictures: while it is on, a mirrored frame is
 * captured several times a second and handed to sendFrame as base64 JPEG
 * together with the options that are current at that moment.
 *
 * @param {{
 *   sendFrame: (imageData: string, options: import("../types").ConversionOptions) => boolean,
 *   options: import("../types").ConversionOptions,
 *   showToast: (message: string, kind?: "info" | "error") => void,
 * }} props
 */
export function useCamera({ sendFrame, options, showToast }) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);

  // The capture loop must see the newest options and sender without restarting
  const latest = useRef({ sendFrame, options });
  useEffect(() => {
    latest.current = { sendFrame, options };
  });

  const session = useRef(
    /** @type {{ stream: MediaStream, timer: ReturnType<typeof setInterval> } | null} */ (
      null
    ),
  );

  const stop = useCallback(() => {
    if (!session.current) return;
    clearInterval(session.current.timer);
    session.current.stream.getTracks().forEach((track) => track.stop());
    session.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    if (session.current || starting) return;
    setStarting(true);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (error) {
      setStarting(false);
      showToast(cameraErrorMessage(error), "error");
      return;
    }

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    const canvas = document.createElement("canvas");

    try {
      await video.play();
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      setStarting(false);
      showToast(cameraErrorMessage(error), "error");
      return;
    }

    const capture = () => {
      if (!video.videoWidth) return; // not showing pictures yet

      const width = Math.min(CAPTURE_WIDTH, video.videoWidth);
      const height = Math.round((video.videoHeight * width) / video.videoWidth);
      canvas.width = width;
      canvas.height = height;

      // Mirrored, like looking in a mirror
      const context = /** @type {CanvasRenderingContext2D} */ (
        canvas.getContext("2d")
      );
      context.setTransform(-1, 0, 0, 1, width, 0);
      context.drawImage(video, 0, 0, width, height);

      const imageData = canvas
        .toDataURL("image/jpeg", JPEG_QUALITY)
        .replace(/^data:image\/jpeg;base64,/, "");
      latest.current.sendFrame(imageData, latest.current.options);
    };

    // If the user unplugs it or revokes access, the tracks end
    stream.getVideoTracks()[0]?.addEventListener("ended", stop);

    session.current = {
      stream,
      timer: setInterval(capture, 1000 / CAMERA_FPS),
    };
    setStarting(false);
    setActive(true);
  }, [starting, showToast, stop]);

  // Never leave the camera light on behind a closed window
  useEffect(() => stop, [stop]);

  return { active, starting, start, stop };
}
