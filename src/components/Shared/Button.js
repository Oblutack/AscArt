import React from "react";

const Button = ({
  children,
  onClick,
  variant = "primary",
  icon,
  fullWidth = false,
  className = "",
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
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
