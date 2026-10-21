import { useState } from "react";

/**
 * A small box for typing a whole number. What is typed only counts on Enter
 * or when leaving the box, so typing "150" doesn't convert at 1 and 15 first;
 * it is then kept between min and max. Escape puts the current value back.
 *
 * @param {{
 *   label: string,
 *   value: number,
 *   min: number,
 *   max: number,
 *   onChange: (value: number) => void,
 * }} props
 */
const NumberField = ({ label, value, min, max, onChange }) => {
  const [draft, setDraft] = useState(String(value));

  // Follow changes made elsewhere (the slider, a restored history entry)
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setDraft(String(value));
  }

  const commit = () => {
    const number = Math.round(Number(draft));
    if (draft.trim() === "" || !Number.isFinite(number)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, number));
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <input
      type="number"
      className="number-input"
      aria-label={label}
      min={min}
      max={max}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(String(value));
      }}
    />
  );
};

export default NumberField;
