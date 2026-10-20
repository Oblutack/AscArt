import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAscart } from "../test/fakeAscart";
import { useConversion } from "./useConversion";

const OPTIONS = { width: 80, removeBackground: false };

let fake;
let showToast;

beforeEach(() => {
  fake = installFakeAscart();
  showToast = vi.fn();
});

const setup = () => renderHook(() => useConversion({ showToast }));

describe("starting a conversion", () => {
  it("sends the path and options with a request id", () => {
    const { result } = setup();

    act(() => result.current.start("C:/a.png", OPTIONS));

    expect(fake.api.convert).toHaveBeenCalledWith(1, "C:/a.png", OPTIONS, true);
    expect(result.current.isLoading).toBe(true);
  });

  it("gives every conversion a new id", () => {
    const { result } = setup();

    act(() => result.current.start("C:/a.png", OPTIONS));
    act(() => result.current.start("C:/a.png", OPTIONS));

    expect(fake.api.convert.mock.calls.map((call) => call[0])).toEqual([1, 2]);
  });

  it("does nothing without a path", () => {
    const { result } = setup();
    act(() => result.current.start(null, OPTIONS));
    expect(fake.api.convert).not.toHaveBeenCalled();
  });

  it("a live preview has no spinner and is not saved to history", () => {
    const { result } = setup();

    act(() => result.current.start("C:/a.png", OPTIONS, { preview: true }));

    expect(fake.api.convert).toHaveBeenCalledWith(
      1,
      "C:/a.png",
      OPTIONS,
      false,
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("warns that background removal on a GIF is slow", () => {
    const { result } = setup();

    act(() =>
      result.current.start("C:/a.gif", { ...OPTIONS, removeBackground: true }),
    );

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("GIF"),
      "info",
    );
  });

  it("doesn't warn for previews or plain images", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.png", { removeBackground: true }));
    act(() =>
      result.current.start(
        "C:/a.gif",
        { removeBackground: true },
        { preview: true },
      ),
    );
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe("results", () => {
  it("shows an image result and stops loading", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.png", OPTIONS));

    fake.emit({ type: "ascii-result", ascii: "<span>@</span>", requestId: 1 });

    expect(result.current.art).toMatchObject({
      ascii: "<span>@</span>",
      isGif: false,
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("shows a GIF result with its first frame", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.gif", OPTIONS));

    fake.emit({
      type: "gif-result",
      frames: ["f1", "f2"],
      delays: [40, 50],
      requestId: 1,
    });

    expect(result.current.art).toEqual({
      ascii: "f1",
      isGif: true,
      frames: ["f1", "f2"],
      delays: [40, 50],
    });
  });

  it("tracks GIF progress and clears it when done", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.gif", OPTIONS));

    fake.emit({ type: "progress", current: 3, total: 10, requestId: 1 });
    expect(result.current.progress).toEqual({ current: 3, total: 10 });

    fake.emit({
      type: "gif-result",
      frames: ["f"],
      delays: [10],
      requestId: 1,
    });
    expect(result.current.progress).toBeNull();
  });

  it("ignores results of an older request", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.png", OPTIONS));
    act(() => result.current.start("C:/b.png", OPTIONS));

    fake.emit({ type: "ascii-result", ascii: "old", requestId: 1 });

    expect(result.current.art.ascii).toBe("");
    expect(result.current.isLoading).toBe(true);

    fake.emit({ type: "ascii-result", ascii: "new", requestId: 2 });
    expect(result.current.art.ascii).toBe("new");
  });

  it("ignores progress of an older request", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.gif", OPTIONS));
    act(() => result.current.start("C:/b.gif", OPTIONS));

    fake.emit({ type: "progress", current: 5, total: 6, requestId: 1 });

    expect(result.current.progress).toBeNull();
  });

  it("keeps the previous art while a preview converts", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.png", OPTIONS));
    fake.emit({ type: "ascii-result", ascii: "first", requestId: 1 });

    act(() => result.current.start("C:/a.png", OPTIONS, { preview: true }));

    expect(result.current.art.ascii).toBe("first");
  });
});

describe("errors", () => {
  it("shows the error and stops loading", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = setup();
    act(() => result.current.start("C:/a.png", OPTIONS));

    fake.emit({
      status: "error",
      error: "Conversion failed: boom",
      requestId: 1,
    });

    expect(showToast).toHaveBeenCalledWith("Conversion failed: boom", "error");
    expect(result.current.isLoading).toBe(false);
  });

  it("shows errors that belong to no request (backend crashed)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setup();

    fake.emit({ status: "error", error: "The Python backend is not running." });

    expect(showToast).toHaveBeenCalledWith(
      "The Python backend is not running.",
      "error",
    );
  });

  it("ignores errors of an older request", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.png", OPTIONS));
    act(() => result.current.start("C:/b.png", OPTIONS));

    fake.emit({ status: "error", error: "old failure", requestId: 1 });

    expect(showToast).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
  });
});

describe("stopping", () => {
  it("cancels the active request and stops loading", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.gif", OPTIONS));
    fake.emit({ type: "progress", current: 1, total: 9, requestId: 1 });

    act(() => result.current.stop());

    expect(fake.api.stop).toHaveBeenCalledWith(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.progress).toBeNull();
  });

  it("drops whatever still arrives for the stopped request", () => {
    const { result } = setup();
    act(() => result.current.start("C:/a.png", OPTIONS));
    act(() => result.current.stop());

    fake.emit({ type: "ascii-result", ascii: "too late", requestId: 1 });

    expect(result.current.art.ascii).toBe("");
  });

  it("tells the user when the backend confirms it stopped", () => {
    setup();
    fake.emit({ type: "stopped" });
    expect(showToast).toHaveBeenCalledWith("Conversion stopped", "info");
  });
});

describe("showArt", () => {
  it("shows a still image", () => {
    const { result } = setup();
    act(() => result.current.showArt("<span>x</span>"));
    expect(result.current.art).toMatchObject({
      ascii: "<span>x</span>",
      isGif: false,
    });
  });

  it("shows a GIF from history", () => {
    const { result } = setup();
    act(() =>
      result.current.showArt("ignored", {
        isGif: true,
        frames: ["a", "b"],
        delays: [1, 2],
      }),
    );
    expect(result.current.art).toEqual({
      ascii: "a",
      isGif: true,
      frames: ["a", "b"],
      delays: [1, 2],
    });
  });
});

it("unsubscribes when unmounted", () => {
  const { unmount } = setup();
  expect(fake.listenerCount()).toBe(1);
  unmount();
  expect(fake.listenerCount()).toBe(0);
});
