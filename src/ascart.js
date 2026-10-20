// The API that electron/preload.js exposes as window.ascart.
//
// It is looked up on every use rather than captured when this file is
// imported, so tests can install a fake before (or after) importing.

/** @type {import("./types").AscartApi} */
export const ascart = new Proxy(/** @type {any} */ ({}), {
  get(_target, name) {
    if (!window.ascart) {
      throw new Error(
        "window.ascart is missing: this page must run inside AscArt's Electron window",
      );
    }
    return window.ascart[
      /** @type {keyof import("./types").AscartApi} */ (name)
    ];
  },
});
