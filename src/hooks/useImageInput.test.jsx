import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAscart } from "../test/fakeAscart";
import { useImageInput } from "./useImageInput";

let fake;
let showToast;

beforeEach(() => {
  fake = installFakeAscart();
  showToast = vi.fn();
});

const png = (name = "cat.png") => new File(["x"], name, { type: "image/png" });

const drop = (files) => {
  const event = new Event("drop", { cancelable: true });
  event.dataTransfer = { files };
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe("loadImage", () => {
  it("keeps the path and a preview of the file", async () => {
    const { result } = renderHook(() => useImageInput({ showToast }));

    act(() => result.current.loadImage(png("cat.png")));

    await waitFor(() =>
      expect(result.current.imagePath).toBe("C:/images/cat.png"),
    );
    expect(result.current.imagePreview).toMatch(/^data:image\/png;base64,/);
  });

  it("clearImage forgets both", async () => {
    const { result } = renderHook(() => useImageInput({ showToast }));
    act(() => result.current.loadImage(png()));
    await waitFor(() => expect(result.current.imagePath).not.toBeNull());

    act(() => result.current.clearImage());

    expect(result.current.imagePath).toBeNull();
    expect(result.current.imagePreview).toBeNull();
  });
});

describe("dropping files on the window", () => {
  it("loads a dropped image", async () => {
    const { result } = renderHook(() => useImageInput({ showToast }));

    const event = drop([png("dropped.png")]);

    expect(event.defaultPrevented).toBe(true); // the window must not navigate
    await waitFor(() =>
      expect(result.current.imagePath).toBe("C:/images/dropped.png"),
    );
  });

  it("takes the first image when several files are dropped", async () => {
    const { result } = renderHook(() => useImageInput({ showToast }));
    const text = new File(["t"], "notes.txt", { type: "text/plain" });

    drop([text, png("second.png")]);

    await waitFor(() =>
      expect(result.current.imagePath).toBe("C:/images/second.png"),
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("says so when the file is not an image", () => {
    const { result } = renderHook(() => useImageInput({ showToast }));

    drop([new File(["t"], "notes.txt", { type: "text/plain" })]);

    expect(showToast).toHaveBeenCalledWith(
      "That file is not an image, GIF or video",
      "error",
    );
    expect(result.current.imagePath).toBeNull();
  });

  it("ignores a drop without files", () => {
    renderHook(() => useImageInput({ showToast }));
    drop([]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("stops listening when unmounted", () => {
    const { unmount } = renderHook(() => useImageInput({ showToast }));
    unmount();

    drop([new File(["t"], "notes.txt", { type: "text/plain" })]);

    expect(showToast).not.toHaveBeenCalled();
  });

  it("prevents the default on dragover so drops are allowed", () => {
    renderHook(() => useImageInput({ showToast }));
    const event = new Event("dragover", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(fake.api.getPathForFile).not.toHaveBeenCalled();
  });
});

describe("videos", () => {
  const video = (name = "clip.mp4", type = "video/mp4") =>
    new File(["v"], name, { type });

  it("knows the path and name, with no preview to read", () => {
    const { result } = renderHook(() => useImageInput({ showToast }));

    act(() => result.current.loadImage(video("holiday.mp4")));

    expect(result.current.imagePath).toBe("C:/images/holiday.mp4");
    expect(result.current.imageName).toBe("holiday.mp4");
    expect(result.current.isVideo).toBe(true);
    expect(result.current.imagePreview).toBeNull();
  });

  it("recognises containers the browser has no type for (mkv, avi)", () => {
    const { result } = renderHook(() => useImageInput({ showToast }));

    act(() => result.current.loadImage(video("old.avi", "")));

    expect(result.current.isVideo).toBe(true);
  });

  it("a dropped video is loaded", () => {
    const { result } = renderHook(() => useImageInput({ showToast }));

    drop([video("dropped.webm", "video/webm")]);

    expect(result.current.imagePath).toBe("C:/images/dropped.webm");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("choosing a picture after a video switches back", async () => {
    const { result } = renderHook(() => useImageInput({ showToast }));
    act(() => result.current.loadImage(video()));

    act(() => result.current.loadImage(png("cat.png")));

    await waitFor(() => expect(result.current.isVideo).toBe(false));
    expect(result.current.imageName).toBe("cat.png");
    expect(result.current.imagePreview).toMatch(/^data:image\/png/);
  });

  it("clearImage forgets the video too", () => {
    const { result } = renderHook(() => useImageInput({ showToast }));
    act(() => result.current.loadImage(video()));

    act(() => result.current.clearImage());

    expect(result.current.imagePath).toBeNull();
    expect(result.current.imageName).toBeNull();
    expect(result.current.isVideo).toBe(false);
  });
});

describe("dragging files over the window", () => {
  const drag = (type, types = ["Files"]) => {
    const event = new Event(type, { cancelable: true });
    event.dataTransfer = { types, files: [] };
    act(() => {
      window.dispatchEvent(event);
    });
  };

  it("is dragging from when files come in until they leave", () => {
    const { result } = renderHook(() => useImageInput({ showToast }));
    expect(result.current.isDragging).toBe(false);

    drag("dragenter");
    expect(result.current.isDragging).toBe(true);

    // crossing into a child element: one more enter, then a leave
    drag("dragenter");
    drag("dragleave");
    expect(result.current.isDragging).toBe(true);

    drag("dragleave");
    expect(result.current.isDragging).toBe(false);
  });

  it("stops when the files are dropped", () => {
    const { result } = renderHook(() => useImageInput({ showToast }));
    drag("dragenter");

    drop([png()]);

    expect(result.current.isDragging).toBe(false);
  });

  it("ignores dragging things that aren't files, like selected text", () => {
    const { result } = renderHook(() => useImageInput({ showToast }));
    drag("dragenter", ["text/plain"]);
    expect(result.current.isDragging).toBe(false);
  });
});
