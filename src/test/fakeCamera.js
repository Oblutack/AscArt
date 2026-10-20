import { vi } from "vitest";

/**
 * Stands in for the browser's camera pieces that jsdom doesn't have:
 * navigator.mediaDevices, video playback and canvas drawing.
 *
 * Returns handles to look at (and change) what the page sees.
 */
export function installFakeCamera({ width = 640, height = 480 } = {}) {
  const trackListeners = {};
  const track = {
    stop: vi.fn(),
    addEventListener: vi.fn((type, callback) => {
      trackListeners[type] = callback;
    }),
  };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };

  const getUserMedia = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  const video = { width, height };
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true,
    get: () => video.width,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    configurable: true,
    get: () => video.height,
  });
  const play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.play = play;

  const context = { setTransform: vi.fn(), drawImage: vi.fn() };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => context);
  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => "data:image/jpeg;base64,QUJD", // "ABC"
  );

  return {
    getUserMedia,
    play,
    track,
    context,
    video,
    /** The camera stops by itself (unplugged, access revoked) */
    endTrack: () => trackListeners.ended?.(),
  };
}
