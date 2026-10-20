import Button from "../Shared/Button";
import Toggle from "../Shared/Toggle";
import { openFilePicker } from "../../lib/dom";

const InputPanel = ({
  onLoadImage,
  removeBackground,
  setRemoveBackground,
  livePreview,
  setLivePreview,
  imagePreview,
  imageName,
  isVideo,
  cameraActive,
  cameraStarting,
  onToggleCamera,
}) => {
  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      onLoadImage(file);
    }
  };

  return (
    <div className="panel input-panel">
      <div className="panel-header">INPUT</div>
      <div className="image-preview-box">
        {cameraActive ? (
          <div className="preview-placeholder preview-video">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span className="preview-caption">Camera is on</span>
          </div>
        ) : isVideo ? (
          <div className="preview-placeholder preview-video">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
              <polygon points="10 9 16 12 10 15 10 9" />
            </svg>
            <span className="preview-caption">{imageName}</span>
          </div>
        ) : imagePreview ? (
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
        accept="image/*,.gif,video/*,.mkv,.avi"
        onChange={handleFileInput}
        style={{ display: "none" }}
      />
      <Button
        variant="load"
        fullWidth
        onClick={openFilePicker}
        shortcut="Ctrl+O"
      >
        LOAD
      </Button>
      <Button
        variant="load"
        fullWidth
        onClick={onToggleCamera}
        disabled={cameraStarting}
        title={cameraActive ? "Turn the camera off" : "Convert the webcam live"}
      >
        {cameraActive ? "STOP CAMERA" : "CAMERA"}
      </Button>
      <Toggle
        label="Remove Background"
        checked={removeBackground}
        onChange={setRemoveBackground}
      />
      <Toggle
        label="Live Preview"
        checked={livePreview}
        onChange={setLivePreview}
      />
    </div>
  );
};

export default InputPanel;
