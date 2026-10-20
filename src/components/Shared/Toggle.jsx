import React from "react";

const Toggle = ({ label, checked, onChange, icon }) => {
  return (
    <label className="toggle-container">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="toggle-input"
      />
      <span className="toggle-checkmark"></span>
      {icon && <span className="toggle-icon">{icon}</span>}
      <span className="toggle-label">{label}</span>
    </label>
  );
};

export default Toggle;
