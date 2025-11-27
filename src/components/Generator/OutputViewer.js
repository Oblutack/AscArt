import React, { useState, useEffect, useRef } from "react";

const OutputViewer = ({ asciiArt, isLoading, isGif, gifFrames, gifDelays }) => {
  const [fontSize, setFontSize] = useState(8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const timerRef = useRef(null);

  // Auto-play GIF when loaded
  useEffect(() => {
    if (isGif && gifFrames.length > 0) {
      setCurrentFrame(0);
      setIsPlaying(true);
    }
  }, [isGif, gifFrames]);

  // Animation playback loop
  useEffect(() => {
    if (isPlaying && isGif && gifFrames.length > 1) {
      const delay = (gifDelays[currentFrame] || 100) / playbackSpeed;
      timerRef.current = setTimeout(() => {
        setCurrentFrame((prev) => (prev + 1) % gifFrames.length);
      }, Math.max(10, delay));
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentFrame, isGif, gifFrames, gifDelays, playbackSpeed]);

  const togglePlayback = () => setIsPlaying(!isPlaying);
  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentFrame(0);
  };

  const displayArt =
    isGif && gifFrames.length > 0 ? gifFrames[currentFrame] : asciiArt;

  return (
    <div className="panel output-panel">
      <div className="panel-header">
        OUTPUT
        {asciiArt && (
          <div className="output-controls">
            {isGif && gifFrames.length > 1 && (
              <>
                <div
                  className="zoom-btn"
                  onClick={togglePlayback}
                  title={isPlaying ? "Pause" : "Play"}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => e.key === "Enter" && togglePlayback()}
                  style={{
                    background: "rgba(73, 80, 87, 0.2)",
                    border: "1px solid rgba(73, 80, 87, 0.5)",
                    color: "#495057",
                    fontFamily: "Arial, sans-serif",
                    fontSize: "12px",
                  }}
                >
                  {isPlaying ? "||" : "▶"}
                </div>
                <div
                  className="zoom-btn"
                  onClick={stopPlayback}
                  title="Stop"
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => e.key === "Enter" && stopPlayback()}
                  style={{
                    background: "rgba(73, 80, 87, 0.2)",
                    border: "1px solid rgba(73, 80, 87, 0.5)",
                    color: "#495057",
                    fontFamily: "Arial, sans-serif",
                    fontSize: "12px",
                  }}
                >
                  ■
                </div>
                <select
                  className="speed-select"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  title="Playback Speed"
                >
                  <option value="0.5">0.5×</option>
                  <option value="1">1×</option>
                  <option value="1.5">1.5×</option>
                  <option value="2">2×</option>
                </select>
                <span className="zoom-label">
                  {currentFrame + 1}/{gifFrames.length}
                </span>
                <span style={{ margin: "0 8px", color: "#666" }}>|</span>
              </>
            )}
            <div
              className="zoom-btn"
              onClick={() => setFontSize(Math.max(4, fontSize - 1))}
              title="Zoom Out"
              role="button"
              tabIndex={0}
              onKeyPress={(e) =>
                e.key === "Enter" && setFontSize(Math.max(4, fontSize - 1))
              }
            >
              −
            </div>
            <span className="zoom-label">{fontSize}px</span>
            <div
              className="zoom-btn"
              onClick={() => setFontSize(Math.min(12, fontSize + 1))}
              title="Zoom In"
              role="button"
              tabIndex={0}
              onKeyPress={(e) =>
                e.key === "Enter" && setFontSize(Math.min(12, fontSize + 1))
              }
            >
              +
            </div>
          </div>
        )}
      </div>
      <div className="output-content">
        {isLoading ? (
          <div className="output-loading">
            <div className="loading-spinner"></div>
            <p>Generating ASCII art...</p>
          </div>
        ) : displayArt ? (
          <pre
            className="ascii-display"
            style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize}px` }}
            dangerouslySetInnerHTML={{ __html: displayArt }}
          />
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
