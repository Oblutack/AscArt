// The line along the bottom of the window: what the app is doing, the
// settings in use, and the keyboard shortcuts worth knowing.

const MOD =
  typeof navigator !== "undefined" && /Mac/.test(navigator.platform)
    ? "⌘"
    : "Ctrl+";

const KEYS = [
  { key: `${MOD}O`, label: "open" },
  { key: `${MOD}↵`, label: "convert" },
  { key: `${MOD}S`, label: "save" },
  { key: `${MOD}H`, label: "history" },
];

/**
 * @param {{
 *   state: "ready" | "live" | "converting" | "camera",
 *   progress?: { current: number, total: number } | null,
 *   details?: string[],
 * }} props
 */
const StatusBar = ({ state, progress, details = [] }) => {
  const text =
    state === "converting" && progress
      ? `converting ${progress.current}/${progress.total}`
      : state === "converting"
        ? "converting"
        : state === "camera"
          ? "camera on"
          : state;

  return (
    <footer className="status-bar">
      <span className={`status-state status-${state}`}>
        <span className="status-dot" aria-hidden="true" />
        {text}
      </span>
      {details.map((detail) => (
        <span key={detail} className="status-detail">
          {detail}
        </span>
      ))}
      <span className="status-spacer" />
      <span className="status-keys" aria-label="Keyboard shortcuts">
        {KEYS.map(({ key, label }) => (
          <span key={label} className="status-key">
            <kbd>{key}</kbd>
            {label}
          </span>
        ))}
      </span>
    </footer>
  );
};

export default StatusBar;
