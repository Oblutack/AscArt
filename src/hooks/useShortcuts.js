import { useEffect, useRef } from "react";

/**
 * Keyboard shortcuts for the whole window.
 *
 *   Ctrl+O        choose a file          Ctrl+S   save
 *   Ctrl+Enter    convert                Ctrl+H   history
 *   Escape        stop a running conversion
 *
 * Command (Meta) works like Ctrl on a Mac. Handlers may change on every
 * render; the listener is only attached once.
 *
 * @param {{
 *   onOpen?: () => void,
 *   onSave?: () => void,
 *   onConvert?: () => void,
 *   onHistory?: () => void,
 *   onStop?: () => void,
 *   canStop?: boolean,
 * }} handlers
 */
export function useShortcuts(handlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    /** @param {KeyboardEvent} event */
    const onKeyDown = (event) => {
      const current = latest.current;

      if (event.key === "Escape") {
        // The gallery has its own Escape; only stop when it isn't open
        if (current.canStop && current.onStop && !event.defaultPrevented) {
          event.preventDefault();
          current.onStop();
        }
        return;
      }

      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) {
        return;
      }

      /** @type {Record<string, (() => void) | undefined>} */
      const actions = {
        o: current.onOpen,
        s: current.onSave,
        h: current.onHistory,
        Enter: current.onConvert,
      };
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const action = actions[key];

      if (action) {
        event.preventDefault();
        action();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
