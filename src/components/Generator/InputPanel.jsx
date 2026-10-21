import Button from "../Shared/Button";
import Icon from "../Shared/Icon";
import Toggle from "../Shared/Toggle";
import { openFilePicker } from "../../lib/dom";

const InputPanel = ({
  onLoadImage,
  removeBackground,
  setRemoveBackground,
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
    <section className="sidebar-section" aria-labelledby="source-heading">
      <h2 id="source-heading" className="section-heading">
        Source
      </h2>
      <div className="source-preview">
        {cameraActive ? (
          <div className="source-placeholder">
            <Icon name="camera" size={28} />
            <span className="source-caption">Camera is on</span>
          </div>
        ) : isVideo ? (
          <div className="source-placeholder">
            <Icon name="video" size={28} />
            <span className="source-caption">{imageName}</span>
          </div>
        ) : imagePreview ? (
          <img src={imagePreview} alt="Preview" className="source-image" />
        ) : (
          <div className="source-placeholder">
            <Icon name="picture" size={28} />
            <span className="source-caption">No picture yet</span>
          </div>
        )}
      </div>
      <input
        type="file"
        id="file-input"
        accept="image/*,.gif,video/*,.mkv,.avi"
        onChange={handleFileInput}
        hidden
      />
      <div className="button-row">
        <Button
          onClick={openFilePicker}
          shortcut="Ctrl+O"
          title="Open a picture, GIF or video"
          icon={<Icon name="open" />}
        >
          Open…
        </Button>
        <Button
          onClick={onToggleCamera}
          disabled={cameraStarting}
          title={
            cameraActive ? "Turn the camera off" : "Convert the webcam live"
          }
          icon={<Icon name="camera" />}
        >
          {cameraActive ? "Stop camera" : "Camera"}
        </Button>
      </div>
      <Toggle
        label="Remove background"
        checked={removeBackground}
        onChange={setRemoveBackground}
      />
    </section>
  );
};

export default InputPanel;
