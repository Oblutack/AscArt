import { useId } from "react";

/**
 * @param {{
 *   label?: string,
 *   ariaLabel?: string,
 *   unit?: string,
 *   value: number,
 *   onChange: (value: number) => void,
 *   min?: number,
 *   max?: number,
 *   step?: number,
 *   showValue?: boolean,
 *   color?: string,
 * }} props
 * With no visible label, pass ariaLabel so the slider still has a name.
 */
const Slider = ({
  label = "",
  ariaLabel,
  unit = "",
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  showValue = true,
  color = "cyan",
}) => {
  const id = useId();

  return (
    <div className="slider-container">
      <div className="slider-header">
        {label && (
          <label className="slider-label" htmlFor={id}>
            {label}:
          </label>
        )}
        {showValue && (
          <span className="slider-value">
            {value}
            {unit}
          </span>
        )}
      </div>
      <input
        id={id}
        type="range"
        aria-label={label ? undefined : ariaLabel}
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
