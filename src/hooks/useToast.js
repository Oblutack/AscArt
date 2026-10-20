import { useCallback, useState } from "react";

/** One notice at a time: showToast replaces whatever is showing. */
export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback(
    (message, kind = "info") => setToast({ id: Date.now(), message, kind }),
    [],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}
