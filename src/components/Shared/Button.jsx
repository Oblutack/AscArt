/**
 * A text button, optionally with an icon.
 *
 *   primary  the one thing to do next (filled with the accent)
 *   outline  an ordinary action
 *   ghost    a quiet action in a toolbar
 *   danger   something that deletes
 *
 * @param {{
 *   children?: import("react").ReactNode,
 *   onClick?: () => void,
 *   variant?: "primary" | "outline" | "ghost" | "danger",
 *   icon?: import("react").ReactNode,
 *   fullWidth?: boolean,
 *   disabled?: boolean,
 *   className?: string,
 *   title?: string,
 *   shortcut?: string,
 * }} props
 */
const Button = ({
  children,
  onClick,
  variant = "outline",
  icon,
  fullWidth = false,
  disabled = false,
  className = "",
  title,
  shortcut,
}) => (
  <button
    type="button"
    className={["btn", `btn-${variant}`, fullWidth && "btn-full", className]
      .filter(Boolean)
      .join(" ")}
    onClick={onClick}
    disabled={disabled}
    title={shortcut ? `${title ?? ""} (${shortcut})`.trim() : title}
    aria-keyshortcuts={shortcut}
  >
    {icon}
    {children}
  </button>
);

export default Button;
