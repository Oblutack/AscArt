import { describe, expect, it } from "vitest";
import {
  isAnimatedPath,
  isGifPath,
  isImageFile,
  isVideoFile,
  isVideoPath,
} from "./paths";

describe("paths", () => {
  it.each(["a.gif", "C:\\x\\a.GIF", "/tmp/a.Gif"])("%s is a GIF", (path) => {
    expect(isGifPath(path)).toBe(true);
    expect(isAnimatedPath(path)).toBe(true);
    expect(isVideoPath(path)).toBe(false);
  });

  it.each(["a.mp4", "a.MOV", "a.webm", "a.mkv", "a.avi", "a.m4v"])(
    "%s is a video",
    (path) => {
      expect(isVideoPath(path)).toBe(true);
      expect(isAnimatedPath(path)).toBe(true);
      expect(isGifPath(path)).toBe(false);
    },
  );

  it.each(["a.png", "a.jpg", "gif", "mp4", "a.mp4.txt", "folder.gif/a.png"])(
    "%s is a still",
    (path) => {
      expect(isAnimatedPath(path)).toBe(false);
    },
  );
});

describe("files", () => {
  const file = (name, type) => new File(["x"], name, { type });

  it("a video is recognised by type or by extension", () => {
    expect(isVideoFile(file("a.bin", "video/x-matroska"))).toBe(true);
    expect(isVideoFile(file("a.mkv", ""))).toBe(true);
    expect(isVideoFile(file("a.png", "image/png"))).toBe(false);
  });

  it("an image is recognised by type", () => {
    expect(isImageFile(file("a.png", "image/png"))).toBe(true);
    expect(isImageFile(file("a.gif", "image/gif"))).toBe(true);
    expect(isImageFile(file("a.mp4", "video/mp4"))).toBe(false);
  });
});
