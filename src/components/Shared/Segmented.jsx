import { useId } from "react";

/**
 * One choice out of a few, shown as a row of buttons. Underneath they are
 * radio buttons, so the arrow keys move between them and screen readers
 * announce the group and the choice.
 *
 * @param {{
 *   label: string,
 *   value: string,
 *   options: { value: string, label: string, title?: string }[],
 *   onChange: (value: string) => void,
 * }} props
 */
const Segmented = ({ label, value, options, onChange }) => {
  const name = useId();

  return (
    <fieldset className="choice-field">
      <legend className="field-label">{label}</legend>
      <div className="segmented">
        {options.map((option) => (
          <label
            key={option.value}
            className="segmented-option"
            title={option.title}
          >
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default Segmented;
