import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_PREVIEW_DELAY_MS, useLivePreview } from "./useLivePreview";

const OPTIONS = { width: 80, removeBackground: false };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const render = (props = {}) => {
  const convert = vi.fn();
  const initial = {
    enabled: true,
    path: "C:/a.png",
    options: OPTIONS,
    convert,
    ...props,
  };
  const hook = renderHook((current) => useLivePreview(current), {
    initialProps: initial,
  });
  return { convert, ...hook, initial };
};

describe("when it runs", () => {
  it("converts as a preview after the delay", () => {
    const { convert } = render();

    expect(convert).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LIVE_PREVIEW_DELAY_MS);

    expect(convert).toHaveBeenCalledWith("C:/a.png", OPTIONS, {
      preview: true,
    });
  });

  it("waits for the changes to stop", () => {
    const { convert, rerender, initial } = render();

    vi.advanceTimersByTime(LIVE_PREVIEW_DELAY_MS - 50);
    rerender({ ...initial, options: { ...OPTIONS, width: 90 } });
    vi.advanceTimersByTime(LIVE_PREVIEW_DELAY_MS - 50);
    expect(convert).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith(
      "C:/a.png",
      { ...OPTIONS, width: 90 },
      { preview: true },
    );
  });

  it("converts again for a new image", () => {
    const { convert, rerender, initial } = render();
    vi.advanceTimersByTime(LIVE_PREVIEW_DELAY_MS);

    rerender({ ...initial, path: "C:/b.png" });
    vi.advanceTimersByTime(LIVE_PREVIEW_DELAY_MS);

    expect(convert).toHaveBeenCalledTimes(2);
    expect(convert).toHaveBeenLastCalledWith("C:/b.png", OPTIONS, {
      preview: true,
    });
  });

  it("drops a pending conversion on unmount", () => {
    const { convert, unmount } = render();
    unmount();
    vi.advanceTimersByTime(LIVE_PREVIEW_DELAY_MS * 2);
    expect(convert).not.toHaveBeenCalled();
  });
});

describe("when it stays quiet", () => {
  it.each([
    ["it is switched off", { enabled: false }],
    ["no image is loaded", { path: null }],
    ["the image is a GIF", { path: "C:/anim.GIF" }],
    ["the file is a video", { path: "C:/clip.MP4" }],
    [
      "background removal is on",
      { options: { ...OPTIONS, removeBackground: true } },
    ],
  ])("when %s", (_name, props) => {
    const { convert } = render(props);
    vi.advanceTimersByTime(LIVE_PREVIEW_DELAY_MS * 2);
    expect(convert).not.toHaveBeenCalled();
  });
});
