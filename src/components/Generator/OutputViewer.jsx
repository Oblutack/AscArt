import { useState, useEffect, useRef } from "react";
import Button from "../Shared/Button";
import Icon from "../Shared/Icon";
import IconButton from "../Shared/IconButton";
import { LINE_HEIGHT } from "../../lib/renderArt";

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
  hasSource = false,
  onOpen,
  onCamera,
  cameraBusy = false,
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

  const hasPlayer = isGif && gifFrames.length > 1;

  return (
    <div className="stage">
      <div className="stage-scroll">
        {isLoading ? (
          <div className="stage-message" role="status">
            <div className="progress-track" aria-hidden="true">
              <div
                className={`progress-fill${progress ? "" : " progress-indeterminate"}`}
                style={
                  progress
                    ? { width: `${(progress.current / progress.total) * 100}%` }
                    : undefined
                }
              />
            </div>
            <p>
              {progress
                ? `Converting frame ${progress.current}/${progress.total}...`
                : "Generating ASCII art..."}
            </p>
            <IconButton
              title="Stop Processing"
              variant="danger"
              onClick={onStopProcessing}
            >
              <Icon name="stop" size={12} />
              Stop
            </IconButton>
          </div>
        ) : displayArt ? (
          <pre
            className="ascii-display"
            role="img"
            aria-label="ASCII art"
            style={{ fontSize: `${fontSize}px`, lineHeight: LINE_HEIGHT }}
            dangerouslySetInnerHTML={{ __html: displayArt }}
          />
        ) : hasSource ? (
          <div className="stage-message">
            <Icon name="convert" size={28} />
            <p className="stage-title">No output yet</p>
            <p>Press Convert to turn it into art</p>
          </div>
        ) : (
          <div className="drop-target">
            <Icon name="drop" size={28} />
            <p className="stage-title">Drop a picture, GIF or video</p>
            <p>anywhere in this window</p>
            <div className="drop-actions">
              <Button
                variant="primary"
                onClick={onOpen}
                shortcut="Ctrl+O"
                title="Open a picture, GIF or video"
              >
                Open a file
              </Button>
              <Button
                onClick={onCamera}
                disabled={cameraBusy}
                icon={<Icon name="camera" />}
              >
                Use the camera
              </Button>
            </div>
            <p className="drop-formats">
              pictures · animated GIFs · mp4 mov webm mkv avi
            </p>
          </div>
        )}
      </div>

      {asciiArt && !isLoading && (
        <div className="stage-controls">
          {hasPlayer && (
            <div className="pill" role="group" aria-label="Playback">
              <IconButton
                title={isPlaying ? "Pause" : "Play"}
                onClick={togglePlayback}
              >
                <Icon name={isPlaying ? "pause" : "play"} size={12} />
              </IconButton>
              <IconButton title="Stop" onClick={stopPlayback}>
                <Icon name="stop" size={12} />
              </IconButton>
              <select
                className="pill-select"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                title="Playback Speed"
                aria-label="Playback Speed"
              >
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
              <span className="pill-label">
                {currentFrame + 1}/{gifFrames.length}
              </span>
            </div>
          )}
          <span className="stage-controls-spacer" />
          <div className="pill" role="group" aria-label="Zoom">
            <IconButton
              title="Zoom Out"
              onClick={() => setFontSize(Math.max(MIN_FONT, fontSize - 1))}
            >
              <Icon name="minus" size={12} />
            </IconButton>
            <span className="pill-label">{fontSize}px</span>
            <IconButton
              title="Zoom In"
              onClick={() => setFontSize(Math.min(MAX_FONT, fontSize + 1))}
            >
              <Icon name="plus" size={12} />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutputViewer;
