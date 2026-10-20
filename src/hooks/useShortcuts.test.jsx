import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useShortcuts } from "./useShortcuts";

const press = (key, options = {}) => {
  const event = new KeyboardEvent("keydown", {
    key,
    cancelable: true,
    bubbles: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
};

const handlers = () => ({
  onOpen: vi.fn(),
  onSave: vi.fn(),
  onConvert: vi.fn(),
  onHistory: vi.fn(),
  onStop: vi.fn(),
  canStop: true,
});

describe("with Ctrl", () => {
  it.each([
    ["o", "onOpen"],
    ["s", "onSave"],
    ["h", "onHistory"],
    ["Enter", "onConvert"],
  ])("Ctrl+%s calls %s", (key, name) => {
    const h = handlers();
    renderHook(() => useShortcuts(h));

    const event = press(key, { ctrlKey: true });

    expect(h[name]).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true); // the browser's own meaning is suppressed
  });

  it("Command works like Ctrl, for Macs", () => {
    const h = handlers();
    renderHook(() => useShortcuts(h));
    press("s", { metaKey: true });
    expect(h.onSave).toHaveBeenCalledTimes(1);
  });

  it("doesn't care about the case of the letter", () => {
    const h = handlers();
    renderHook(() => useShortcuts(h));
    press("S", { ctrlKey: true });
    expect(h.onSave).toHaveBeenCalledTimes(1);
  });

  it("leaves other combinations alone", () => {
    const h = handlers();
    renderHook(() => useShortcuts(h));

    const withShift = press("s", { ctrlKey: true, shiftKey: true });
    const withAlt = press("s", { ctrlKey: true, altKey: true });
    const other = press("x", { ctrlKey: true });

    expect(h.onSave).not.toHaveBeenCalled();
    for (const event of [withShift, withAlt, other]) {
      expect(event.defaultPrevented).toBe(false);
    }
  });
});

describe("without Ctrl", () => {
  it("plain letters and Enter do nothing (they belong to the focused control)", () => {
    const h = handlers();
    renderHook(() => useShortcuts(h));

    press("s");
    press("Enter");

    expect(h.onSave).not.toHaveBeenCalled();
    expect(h.onConvert).not.toHaveBeenCalled();
  });
});

describe("Escape", () => {
  it("stops a running conversion", () => {
    const h = handlers();
    renderHook(() => useShortcuts(h));
    press("Escape");
    expect(h.onStop).toHaveBeenCalledTimes(1);
  });

  it("does nothing when nothing is running", () => {
    const h = { ...handlers(), canStop: false };
    renderHook(() => useShortcuts(h));
    press("Escape");
    expect(h.onStop).not.toHaveBeenCalled();
  });

  it("does nothing if something else already used the key", () => {
    const h = handlers();
    renderHook(() => useShortcuts(h));

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    event.preventDefault();
    window.dispatchEvent(event);

    expect(h.onStop).not.toHaveBeenCalled();
  });
});

describe("lifecycle", () => {
  it("always uses the latest handlers", () => {
    const first = handlers();
    const second = handlers();
    const { rerender } = renderHook((h) => useShortcuts(h), {
      initialProps: first,
    });

    rerender(second);
    press("s", { ctrlKey: true });

    expect(first.onSave).not.toHaveBeenCalled();
    expect(second.onSave).toHaveBeenCalledTimes(1);
  });

  it("stops listening when unmounted", () => {
    const h = handlers();
    const { unmount } = renderHook(() => useShortcuts(h));
    unmount();
    press("s", { ctrlKey: true });
    expect(h.onSave).not.toHaveBeenCalled();
  });

  it("copes with missing handlers", () => {
    renderHook(() => useShortcuts({}));
    expect(() => press("s", { ctrlKey: true })).not.toThrow();
  });
});
