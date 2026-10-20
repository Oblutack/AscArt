import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { installFakeAscart } from "../test/fakeAscart";
import { DEFAULT_SETTINGS, pickSettings, useSettings } from "./useSettings";

let fake;

beforeEach(() => {
  fake = installFakeAscart();
});

describe("pickSettings", () => {
  it("keeps known keys and drops everything else", () => {
    expect(pickSettings({ width: 50, evil: "x", __proto__: { a: 1 } })).toEqual(
      {
        width: 50,
      },
    );
  });

  it("skips null and undefined, so history's null ratio falls back", () => {
    expect(
      pickSettings({ ratio: null, width: undefined, contrast: 0 }),
    ).toEqual({
      contrast: 0,
    });
  });

  it("copes with nothing saved", () => {
    expect(pickSettings(null)).toEqual({});
  });
});

describe("loading and saving", () => {
  it("starts from the defaults", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("applies saved settings and marks them loaded", async () => {
    fake = installFakeAscart({
      loadSettings: () => Promise.resolve({ width: 77, colorScheme: "sepia" }),
    });
    const { result } = renderHook(() => useSettings());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.settings.width).toBe(77);
    expect(result.current.settings.colorScheme).toBe("sepia");
    expect(result.current.settings.charset).toBe("detailed"); // untouched default
  });

  it("is loaded even when nothing was saved", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loaded).toBe(true));
  });

  it("does not save the defaults before the saved settings arrived", async () => {
    let finishLoading;
    fake = installFakeAscart({
      loadSettings: () => new Promise((resolve) => (finishLoading = resolve)),
    });
    renderHook(() => useSettings());

    expect(fake.api.saveSettings).not.toHaveBeenCalled();
    await act(async () => finishLoading({ width: 55 }));
    expect(fake.api.saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 55 }),
    );
  });

  it("saves every change, including the color scheme", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.setSetting("colorScheme", "cyan"));

    expect(fake.api.saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ colorScheme: "cyan" }),
    );
  });
});

describe("changing settings", () => {
  it("resetAdjustments restores only the four adjustment values", async () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.setSetting("brightness", 40);
      result.current.setSetting("contrast", 150);
      result.current.setSetting("invert", true);
      result.current.setSetting("dither", true);
      result.current.setSetting("width", 200);
    });

    act(() => result.current.resetAdjustments());

    expect(result.current.settings).toMatchObject({
      brightness: 0,
      contrast: 100,
      invert: false,
      dither: false,
      width: 200, // not an adjustment
    });
  });

  it("restoreOptions brings back a history entry's options but keeps live preview", () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setSetting("livePreview", false));

    act(() =>
      result.current.restoreOptions({
        width: 90,
        charset: "blocks",
        colorScheme: "sepia",
        dither: true,
        ratio: null,
      }),
    );

    expect(result.current.settings).toMatchObject({
      width: 90,
      charset: "blocks",
      colorScheme: "sepia",
      dither: true,
      ratio: "--", // null in history means "no ratio"
      livePreview: false,
    });
  });
});

describe("conversionOptions", () => {
  it("is what the backend expects", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.conversionOptions).toEqual({
      width: 120,
      charset: "detailed",
      colorScheme: "original",
      removeBackground: false,
      brightness: 0,
      contrast: 100,
      invert: false,
      dither: false,
      ratio: null,
      keepOriginal: false,
    });
  });

  it("sends a chosen ratio and leaves live preview out", () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.setSetting("ratio", "16:9"));

    expect(result.current.conversionOptions.ratio).toBe("16:9");
    expect(result.current.conversionOptions).not.toHaveProperty("livePreview");
  });

  it("keeps the same object while unrelated settings change", () => {
    const { result } = renderHook(() => useSettings());
    const before = result.current.conversionOptions;

    act(() => result.current.setSetting("livePreview", false));

    expect(result.current.conversionOptions).toBe(before);
  });
});
