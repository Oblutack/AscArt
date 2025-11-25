import React from "react";
import Button from "../Shared/Button";
import Toggle from "../Shared/Toggle";

const InputPanel = ({
  onLoadImage,
  removeBackground,
  setRemoveBackground,
  imagePreview,
}) => {
  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      onLoadImage(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("image/") || file.type === "image/gif")) {
      onLoadImage(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="panel input-panel">
      <div className="panel-header">INPUT</div>
      <div
        className="image-preview-box"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {imagePreview ? (
          <img src={imagePreview} alt="Preview" className="preview-image" />
        ) : (
          <div className="preview-placeholder">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
      </div>
      <input
        type="file"
        id="file-input"
        accept="image/*,.gif"
        onChange={handleFileInput}
        style={{ display: "none" }}
      />
      <Button
        variant="load"
        fullWidth
        onClick={() => document.getElementById("file-input").click()}
      >
        LOAD
      </Button>
      <Toggle
        label="Remove Background"
        checked={removeBackground}
        onChange={setRemoveBackground}
      />
    </div>
  );
};

export default InputPanel;
