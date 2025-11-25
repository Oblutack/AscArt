import React, { useState } from "react";

const OutputViewer = ({ asciiArt, isLoading }) => {
  const [fontSize, setFontSize] = useState(8);

  return (
    <div className="panel output-panel">
      <div className="panel-header">
        OUTPUT
        {asciiArt && (
          <div className="output-controls">
            <button
              className="zoom-btn"
              onClick={() => setFontSize(Math.max(4, fontSize - 1))}
              title="Zoom Out"
            >
              −
            </button>
            <span className="zoom-label">{fontSize}px</span>
            <button
              className="zoom-btn"
              onClick={() => setFontSize(Math.min(12, fontSize + 1))}
              title="Zoom In"
            >
              +
            </button>
          </div>
        )}
      </div>
      <div className="output-content">
        {isLoading ? (
          <div className="output-loading">
            <div className="loading-spinner"></div>
            <p>Generating ASCII art...</p>
          </div>
        ) : asciiArt ? (
          <pre
            className="ascii-display"
            style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize}px` }}
          >
            {asciiArt}
          </pre>
        ) : (
          <div className="output-placeholder">
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p className="placeholder-title">No output yet</p>
            <p className="placeholder-subtitle">
              Load an image or GIF to generate ASCII art
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputViewer;
