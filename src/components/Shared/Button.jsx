/**
 * @param {{
 *   children?: import("react").ReactNode,
 *   onClick?: () => void,
 *   variant?: string,
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
  variant = "primary",
  icon,
  fullWidth = false,
  disabled = false,
  className = "",
  title,
  shortcut,
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case "save":
        return "btn-save";
      case "widget":
        return "btn-widget";
      case "history":
        return "btn-history";
      case "quit":
        return "btn-quit";
      case "load":
        return "btn-load";
      default:
        return "btn-primary";
    }
  };

  return (
    <button
      className={`neon-button ${getVariantClass()} ${
        fullWidth ? "full-width" : ""
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${title ?? ""} (${shortcut})`.trim() : title}
      aria-keyshortcuts={shortcut}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
