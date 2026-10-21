import Slider from "../Shared/Slider";
import Dropdown from "../Shared/Dropdown";
import Toggle from "../Shared/Toggle";

const ratioOptions = [
  { value: "--", label: "--" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1" },
  { value: "9:16", label: "9:16" },
];

const charsetOptions = [
  { value: "detailed", label: "Detailed" },
  { value: "blocks", label: "Blocks" },
  { value: "custom", label: "Custom..." },
];

const colorSchemeOptions = [
  { value: "original", label: "Original" },
  { value: "grayscale", label: "Grayscale" },
  { value: "sepia", label: "Sepia" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "red", label: "Red" },
  { value: "purple", label: "Purple" },
  { value: "cyan", label: "Cyan" },
];

/** The Style section: characters, colours and size */
const WidthPanel = ({
  width,
  setWidth,
  ratio,
  setRatio,
  keepOriginal,
  setKeepOriginal,
  charset,
  setCharset,
  customChars,
  setCustomChars,
  customCharsError,
  colorScheme,
  setColorScheme,
}) => (
  <section className="sidebar-section" aria-labelledby="style-heading">
    <h2 id="style-heading" className="section-heading">
      Style
    </h2>

    <div className="field-row">
      <label className="field-label" htmlFor="style-select">
        Style:
      </label>
      <Dropdown
        id="style-select"
        value={charset}
        onChange={setCharset}
        options={charsetOptions}
      />
    </div>
    {charset === "custom" && (
      <div className="field">
        <div className="field-row">
          <label className="field-label" htmlFor="custom-chars">
            Chars:
          </label>
          <input
            id="custom-chars"
            className="text-input"
            type="text"
            value={customChars}
            maxLength={100}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={customCharsError ? "true" : undefined}
            aria-describedby="custom-chars-help"
            onChange={(e) => setCustomChars(e.target.value)}
          />
        </div>
        <p
          id="custom-chars-help"
          className={customCharsError ? "field-error" : "field-hint"}
          role={customCharsError ? "alert" : undefined}
        >
          {customCharsError ?? "Darkest first, lightest last"}
        </p>
      </div>
    )}

    <div className="field-row">
      <label className="field-label" htmlFor="colors-select">
        Colors:
      </label>
      <Dropdown
        id="colors-select"
        value={colorScheme}
        onChange={setColorScheme}
        options={colorSchemeOptions}
      />
    </div>

    <div className="field">
      <div className="field-head">
        <span className="field-label" aria-hidden="true">
          Width
        </span>
        <span className="field-value">
          <span className="width-number">{width}</span> chars
        </span>
      </div>
      <Slider
        ariaLabel="Width"
        value={width}
        onChange={setWidth}
        min={20}
        max={300}
        step={1}
        showValue={false}
      />
    </div>

    <div className="field-row">
      <label className="field-label" htmlFor="ratio-select">
        Ratio:
      </label>
      <Dropdown
        id="ratio-select"
        value={ratio}
        onChange={setRatio}
        options={ratioOptions}
      />
    </div>

    <Toggle
      label="Keep Original (max 400)"
      checked={keepOriginal}
      onChange={setKeepOriginal}
    />
  </section>
);

export default WidthPanel;
