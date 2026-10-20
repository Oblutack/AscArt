// Video containers the backend can read (through ffmpeg). Keep in step with
// VIDEO_EXTENSIONS in python/core/video.py.
const VIDEO_EXTENSIONS = [".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi"];

/** @param {string} name a file name or path */
const extensionOf = (name) =>
  (/\.[^.\\/]+$/.exec(name)?.[0] ?? "").toLowerCase();

export const isGifPath = (/** @type {string} */ path) =>
  extensionOf(path) === ".gif";

export const isVideoPath = (/** @type {string} */ path) =>
  VIDEO_EXTENSIONS.includes(extensionOf(path));

/** GIFs and videos are converted frame by frame, which is slow */
export const isAnimatedPath = (/** @type {string} */ path) =>
  isGifPath(path) || isVideoPath(path);

/**
 * Whether a dropped or picked file is a video. The browser's own type is
 * missing for some containers (mkv, avi), so the extension counts too.
 * @param {File} file
 */
export const isVideoFile = (file) =>
  file.type.startsWith("video/") || isVideoPath(file.name);

/** @param {File} file */
export const isImageFile = (file) => file.type.startsWith("image/");
