import React from "react";
import Slider from "../Shared/Slider";
import Toggle from "../Shared/Toggle";

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
}) => {
  return (
    <div className="panel adjustment-panel">
      <div className="panel-header">ADJUSTMENTS</div>
      <div className="adjustment-top">
        <Toggle label="INVERT" checked={invert} onChange={setInvert} />
        <Toggle label="DITHER" checked={dither} onChange={setDither} />
        <button className="reset-button" onClick={onReset}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          RESET
        </button>
      </div>
      <div className="sliders-row">
        <Slider
          label="Brightness"
          value={brightness}
          onChange={setBrightness}
          min={-100}
          max={100}
          step={1}
          showValue={true}
          color="cyan"
        />
        <Slider
          label="Contrast"
          value={contrast}
          onChange={setContrast}
          min={0}
          max={200}
          step={1}
          showValue={true}
          color="cyan"
        />
      </div>
    </div>
  );
};

export default AdjustmentPanel;
