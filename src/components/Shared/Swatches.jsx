import { useId } from "react";

/**
 * A choice of colours as a row of small swatches, with the chosen one's name
 * beside the label. Radio buttons underneath, like Segmented.
 *
 * @param {{
 *   label: string,
 *   value: string,
 *   options: { value: string, label: string, color: string }[],
 *   onChange: (value: string) => void,
 * }} props
 */
const Swatches = ({ label, value, options, onChange }) => {
  const name = useId();
  const chosen = options.find((option) => option.value === value);

  return (
    <fieldset className="choice-field">
      <legend className="field-head">
        <span className="field-label">{label}</span>
        <span className="field-value" aria-hidden="true">
          {chosen?.label.toLowerCase()}
        </span>
      </legend>
      <div className="swatches">
        {options.map((option) => (
          <label key={option.value} className="swatch" title={option.label}>
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span
              className="swatch-chip"
              style={{ background: option.color }}
              aria-hidden="true"
            />
            <span className="visually-hidden">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default Swatches;
