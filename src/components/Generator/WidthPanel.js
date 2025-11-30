import React from "react";
import Slider from "../Shared/Slider";
import Dropdown from "../Shared/Dropdown";
import Toggle from "../Shared/Toggle";

const WidthPanel = ({
  width,
  setWidth,
  ratio,
  setRatio,
  keepOriginal,
  setKeepOriginal,
  charset,
  setCharset,
  colorScheme,
  setColorScheme,
}) => {
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

  return (
    <div className="panel width-panel">
      <div className="panel-header">WIDTH</div>
      <div className="width-display">{width}</div>
      <div className="width-label">chars</div>
      <Slider
        label=""
        value={width}
        onChange={setWidth}
        min={20}
        max={300}
        step={1}
        showValue={false}
        color="magenta"
      />
      <div className="ratio-section">
        <label className="ratio-label">Ratio:</label>
        <Dropdown
          value={ratio}
          onChange={setRatio}
          options={ratioOptions}
          className="ratio-dropdown"
        />
      </div>
      <div className="ratio-section">
        <label className="ratio-label">Style:</label>
        <Dropdown
          value={charset}
          onChange={setCharset}
          options={charsetOptions}
          className="ratio-dropdown"
        />
      </div>
      <div className="ratio-section">
        <label className="ratio-label">Colors:</label>
        <Dropdown
          value={colorScheme}
          onChange={setColorScheme}
          options={colorSchemeOptions}
          className="ratio-dropdown"
        />
      </div>
      <Toggle
        label="Keep Original"
        checked={keepOriginal}
        onChange={setKeepOriginal}
      />
    </div>
  );
};

export default WidthPanel;
