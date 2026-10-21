import Icon from "../Shared/Icon";
import Slider from "../Shared/Slider";
import Toggle from "../Shared/Toggle";

/** The Tone section: brightness, contrast, invert and halftone */
const AdjustmentPanel = ({
  invert,
  setInvert,
  dither,
  setDither,
  brightness,
  setBrightness,
  contrast,
  setContrast,
  onReset,
}) => (
  <section className="sidebar-section" aria-labelledby="tone-heading">
    <div className="section-head">
      <h2 id="tone-heading" className="section-heading">
        Tone
      </h2>
      <button type="button" className="link-button" onClick={onReset}>
        <Icon name="reset" size={12} />
        RESET
      </button>
    </div>
    <Slider
      label="Brightness"
      value={brightness}
      onChange={setBrightness}
      min={-100}
      max={100}
      step={1}
      showValue={true}
    />
    <Slider
      label="Contrast"
      unit="%"
      value={contrast}
      onChange={setContrast}
      min={0}
      max={200}
      step={1}
      showValue={true}
    />
    <div className="toggle-row">
      <Toggle label="INVERT" checked={invert} onChange={setInvert} />
      <Toggle label="DITHER" checked={dither} onChange={setDither} />
    </div>
  </section>
);

export default AdjustmentPanel;
