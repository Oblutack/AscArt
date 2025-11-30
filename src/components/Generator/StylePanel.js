import React from "react";
import Dropdown from "../Shared/Dropdown";

const StylePanel = ({ charset, setCharset, colorScheme, setColorScheme }) => {
  const charsetOptions = [
    { value: "detailed", label: "Detailed" },
    { value: "standard", label: "Standard" },
    { value: "simple", label: "Simple" },
  ];

  const colorSchemeOptions = [
    { value: "original", label: "Original Colors" },
    { value: "grayscale", label: "Grayscale" },
    { value: "sepia", label: "Sepia" },
    { value: "blue", label: "Blue Tone" },
    { value: "green", label: "Green Tone" },
    { value: "red", label: "Red Tone" },
    { value: "purple", label: "Purple Tone" },
    { value: "cyan", label: "Cyan Tone" },
  ];

  const getCharsetPreview = () => {
    switch (charset) {
      case "detailed":
        return "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";
      case "standard":
        return "@%#*+=-:. ";
      case "simple":
        return "█▓▒░ ";
      default:
        return "";
    }
  };

  return (
    <div className="panel style-panel">
      <div className="panel-header">STYLE</div>
      <div className="style-label">Character Set:</div>
      <Dropdown
        value={charset}
        onChange={setCharset}
        options={charsetOptions}
      />
      <div className="charset-preview">
        <div className="preview-label">Preview:</div>
        <div className="preview-text">{getCharsetPreview()}</div>
      </div>
      <div className="style-label" style={{ marginTop: "15px" }}>
        Color Scheme:
      </div>
      <Dropdown
        value={colorScheme}
        onChange={setColorScheme}
        options={colorSchemeOptions}
      />
    </div>
  );
};

export default StylePanel;
