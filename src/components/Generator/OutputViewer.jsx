import { useState, useEffect, useRef } from "react";
import IconButton from "../Shared/IconButton";

const MIN_FONT = 4;
const MAX_FONT = 12;

const OutputViewer = ({
  asciiArt,
  isLoading,
  progress,
  isGif,
  gifFrames,
  gifDelays,
  onStopProcessing,
}) => {
  const [fontSize, setFontSize] = useState(8);
  const [isPlaying, setIsPlaying] = useState(isGif && gifFrames.length > 0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const timerRef = useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  );

  // A newly loaded GIF starts playing from its first frame. Adjusting state
  // during render (rather than in an effect) avoids a render with stale state.
  const [shownFrames, setShownFrames] = useState(gifFrames);
  if (gifFrames !== shownFrames) {
    setShownFrames(gifFrames);
    setCurrentFrame(0);
    setIsPlaying(isGif && gifFrames.length > 0);
  }

  // Animation playback loop
  useEffect(() => {
    if (isPlaying && isGif && gifFrames.length > 1) {
      const delay = (gifDelays[currentFrame] || 100) / playbackSpeed;
      timerRef.current = setTimeout(
        () => {
          setCurrentFrame((prev) => (prev + 1) % gifFrames.length);
        },
        Math.max(10, delay),
      );
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
        <div className="output-controls">
          {isLoading && (
            <IconButton
              title="Stop Processing"
              variant="danger"
              onClick={onStopProcessing}
            >
              STOP
            </IconButton>
          )}
          {asciiArt && (
            <>
              {isGif && gifFrames.length > 1 && (
                <>
                  <IconButton
                    title={isPlaying ? "Pause" : "Play"}
                    onClick={togglePlayback}
                  >
                    {isPlaying ? "||" : "▶"}
                  </IconButton>
                  <IconButton title="Stop" onClick={stopPlayback}>
                    ■
                  </IconButton>
                  <select
                    className="speed-select"
                    value={playbackSpeed}
                    onChange={(e) =>
                      setPlaybackSpeed(parseFloat(e.target.value))
                    }
                    title="Playback Speed"
                    aria-label="Playback Speed"
                  >
                    <option value="0.5">0.5×</option>
                    <option value="1">1×</option>
                    <option value="1.5">1.5×</option>
                    <option value="2">2×</option>
                  </select>
                  <span className="zoom-label">
                    {currentFrame + 1}/{gifFrames.length}
                  </span>
                  <span className="output-divider" aria-hidden="true">
                    |
                  </span>
                </>
              )}
              <IconButton
                title="Zoom Out"
                onClick={() => setFontSize(Math.max(MIN_FONT, fontSize - 1))}
              >
                −
              </IconButton>
              <span className="zoom-label">{fontSize}px</span>
              <IconButton
                title="Zoom In"
                onClick={() => setFontSize(Math.min(MAX_FONT, fontSize + 1))}
              >
                +
              </IconButton>
            </>
          )}
        </div>
      </div>
      <div className="output-content">
        {isLoading ? (
          <div className="output-loading" role="status">
            <div className="loading-spinner"></div>
            <p>
              {progress
                ? `Converting frame ${progress.current}/${progress.total}...`
                : "Generating ASCII art..."}
            </p>
          </div>
        ) : displayArt ? (
          <pre
            className="ascii-display"
            role="img"
            aria-label="ASCII art"
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
              aria-hidden="true"
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
