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
      "That file is not an image",
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
