/**
 * An on/off switch with its label in front. A checkbox with the switch role
 * underneath, so it is announced as "on" or "off".
 *
 * @param {{
 *   label: string,
 *   checked: boolean,
 *   onChange: (checked: boolean) => void,
 *   title?: string,
 * }} props
 */
const Switch = ({ label, checked, onChange, title }) => (
  <label className="switch" title={title}>
    <span className="switch-label">{label}</span>
    <input
      type="checkbox"
      role="switch"
      className="visually-hidden"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="switch-track" aria-hidden="true">
      <span className="switch-thumb" />
    </span>
  </label>
);

export default Switch;
