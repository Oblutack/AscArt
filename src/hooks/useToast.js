import { useCallback, useState } from "react";

/** One notice at a time: showToast replaces whatever is showing. */
export function useToast() {
  const [toast, setToast] = useState(
    /** @type {{ id: number, message: string, kind: "info" | "error" } | null} */ (
      null
    ),
  );

  const showToast = useCallback(
    (
      /** @type {string} */ message,
      kind = /** @type {"info" | "error"} */ ("info"),
    ) => setToast({ id: Date.now(), message, kind }),
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}
