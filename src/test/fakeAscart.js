import { act } from "@testing-library/react";
import { vi } from "vitest";

/**
 * Installs a fake window.ascart (what electron/preload.js provides) and
 * returns it along with emit(), which delivers a message from the "backend"
 * to everything that subscribed with onResponse.
 */
export function installFakeAscart(overrides = {}) {
  const listeners = new Set();

  const api = {
    convert: vi.fn(),
    stop: vi.fn(),
    getHistory: vi.fn(),
    getHistoryEntry: vi.fn(),
    deleteHistory: vi.fn(),
    onResponse: vi.fn((callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }),
    chooseSavePath: vi.fn().mockResolvedValue({ filePath: "C:/out/art.html" }),
    saveAscii: vi.fn((art, filePath) => Promise.resolve({ filePath })),
    saveBinary: vi.fn((filePath) => Promise.resolve({ filePath })),
    copyText: vi.fn().mockResolvedValue({ copied: true }),
    loadSettings: vi.fn().mockResolvedValue(null),
    saveSettings: vi.fn(),
    getPathForFile: vi.fn((file) => `C:/images/${file.name}`),
    openWidget: vi.fn(),
    minimize: vi.fn(),
    quit: vi.fn(),
    ...overrides,
  };

  window.ascart = api;

  const emit = (message) =>
    act(() => {
      listeners.forEach((callback) => callback(message));
    });

  return { api, emit, listenerCount: () => listeners.size };
}
