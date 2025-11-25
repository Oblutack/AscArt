import React from "react";
import Dropdown from "../Shared/Dropdown";

const StylePanel = ({ charset, setCharset }) => {
  const charsetOptions = [
    { value: "detailed", label: "Detailed" },
    { value: "standard", label: "Standard" },
    { value: "simple", label: "Simple" },
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
      <Dropdown
        value={charset}
        onChange={setCharset}
        options={charsetOptions}
      />
      <div className="charset-preview">
        <div className="preview-label">Preview:</div>
        <div className="preview-text">{getCharsetPreview()}</div>
      </div>
    </div>
  );
};

export default StylePanel;
