import React from "react";

const Slider = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  showValue = true,
  color = "cyan",
}) => {
  return (
    <div className="slider-container">
      <div className="slider-header">
        <label className="slider-label">{label}:</label>
        {showValue && (
          <span className="slider-value">
            {value}
            {label === "Contrast" ? "%" : ""}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`neon-slider slider-${color}`}
      />
    </div>
  );
};

export default Slider;
