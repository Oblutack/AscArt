import React, { useEffect } from "react";

// Errors stay up a bit longer than plain notices
const DURATION_MS = { info: 4000, error: 8000 };

const Toast = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, DURATION_MS[toast.kind] || 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className={`toast toast-${toast.kind}`}
      role={toast.kind === "error" ? "alert" : "status"}
      onClick={onDismiss}
      title="Click to dismiss"
    >
      {toast.message}
    </div>
  );
};

export default Toast;
