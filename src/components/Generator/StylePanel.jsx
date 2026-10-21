import NumberField from "../Shared/NumberField";
import Segmented from "../Shared/Segmented";
import Slider from "../Shared/Slider";
import Swatches from "../Shared/Swatches";
import Toggle from "../Shared/Toggle";

const MIN_WIDTH = 20;
const MAX_WIDTH = 300;

const charsetOptions = [
  {
    value: "detailed",
    label: "detailed",
    title: "Many characters, from dense to light",
  },
  { value: "blocks", label: "blocks", title: "Solid block characters" },
  { value: "custom", label: "custom", title: "Your own characters" },
];

// The colour of each swatch only hints at the scheme
const colorSchemeOptions = [
  {
    value: "original",
    label: "Original",
    color:
      "conic-gradient(#f7768e, #e0af68, #9ece6a, #7dcfff, #7aa2f7, #bb9af7, #f7768e)",
  },
  { value: "grayscale", label: "Grayscale", color: "#a3a8b3" },
  { value: "sepia", label: "Sepia", color: "#b48a5a" },
  { value: "blue", label: "Blue", color: "#5b8def" },
  { value: "green", label: "Green", color: "#73c991" },
  { value: "red", label: "Red", color: "#e5636e" },
  { value: "purple", label: "Purple", color: "#a98bf0" },
  { value: "cyan", label: "Cyan", color: "#5fd0e0" },
];

const ratioOptions = [
  { value: "--", label: "auto", title: "The picture's own shape" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

/** The Style section: characters, colours and size */
const StylePanel = ({
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

    <Segmented
      label="Characters"
      value={charset}
      options={charsetOptions}
      onChange={setCharset}
    />
    {charset === "custom" && (
      <div className="field">
        <label className="field-label" htmlFor="custom-chars">
          Your characters
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
        <p
          id="custom-chars-help"
          className={customCharsError ? "field-error" : "field-hint"}
          role={customCharsError ? "alert" : undefined}
        >
          {customCharsError ?? "Darkest first, lightest last"}
        </p>
      </div>
    )}

    <Swatches
      label="Colors"
      value={colorScheme}
      options={colorSchemeOptions}
      onChange={setColorScheme}
    />

    <div className="field">
      <div className="field-head">
        <span className="field-label" aria-hidden="true">
          Width
        </span>
        <span className="field-value">
          <NumberField
            label="Width in characters"
            value={width}
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            onChange={setWidth}
          />
          chars
        </span>
      </div>
      <Slider
        ariaLabel="Width"
        value={width}
        onChange={setWidth}
        min={MIN_WIDTH}
        max={MAX_WIDTH}
        step={1}
        showValue={false}
      />
    </div>

    <Segmented
      label="Shape"
      value={ratio}
      options={ratioOptions}
      onChange={setRatio}
    />

    <Toggle
      label="Native size (up to 400)"
      checked={keepOriginal}
      onChange={setKeepOriginal}
    />
  </section>
);

export default StylePanel;
