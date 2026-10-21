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
}) => {
  const id = useId();
  // How far along the track the value is, for the filled part of the track
  const fill = `${((value - min) / (max - min)) * 100}%`;

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
        className="neon-slider"
        style={
          /** @type {import("react").CSSProperties} */ ({ "--fill": fill })
        }
      />
    </div>
  );
};

export default Slider;
