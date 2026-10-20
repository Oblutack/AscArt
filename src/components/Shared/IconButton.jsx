/**
 * A small square button (zoom, play, stop). A real <button>, so it can be
 * focused and pressed from the keyboard; the title is also its accessible name.
 *
 * @param {{
 *   title: string,
 *   onClick: () => void,
 *   variant?: "danger",
 *   children: import("react").ReactNode,
 * }} props
 */
const IconButton = ({ title, onClick, variant, children }) => (
  <button
    type="button"
    className={`zoom-btn${variant ? ` zoom-btn-${variant}` : ""}`}
    title={title}
    aria-label={title}
    onClick={onClick}
  >
    {children}
  </button>
);

export default IconButton;
