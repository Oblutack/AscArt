import { useState } from "react";
import { ascart } from "./ascart";
import { useCamera } from "./hooks/useCamera";
import { useConversion } from "./hooks/useConversion";
import { useImageInput } from "./hooks/useImageInput";
import { useLivePreview } from "./hooks/useLivePreview";
import { useSettings } from "./hooks/useSettings";
import { useShortcuts } from "./hooks/useShortcuts";
import { useToast } from "./hooks/useToast";
import MainLayout from "./layouts/MainLayout";
import InputPanel from "./components/Generator/InputPanel";
import StylePanel from "./components/Generator/StylePanel";
import AdjustmentPanel from "./components/Generator/AdjustmentPanel";
import OutputViewer from "./components/Generator/OutputViewer";
import Toolbar from "./components/Generator/Toolbar";
import StatusBar from "./components/Generator/StatusBar";
import GalleryView from "./components/Gallery/GalleryView";
import Toast from "./components/Shared/Toast";
import Button from "./components/Shared/Button";
import Icon from "./components/Shared/Icon";
import Switch from "./components/Shared/Switch";
import { artSize } from "./lib/artSize";
import { customCharsError } from "./lib/customChars";
import { openFilePicker } from "./lib/dom";
import { isAnimatedPath } from "./lib/paths";
import { saveArt } from "./lib/saveArt";

function App() {
  const { toast, showToast, dismissToast } = useToast();
  const {
    settings,
    loaded: settingsLoaded,
    setSetting,
    resetAdjustments,
    restoreOptions,
    conversionOptions,
  } = useSettings();
  const { art, isLoading, progress, start, startFrame, stop, showArt } =
    useConversion({ showToast });
  const [showGallery, setShowGallery] = useState(false);

  // A half-typed character set shouldn't be sent to the backend
  const charsetError =
    settings.charset === "custom"
      ? customCharsError(settings.customChars)
      : null;

  const camera = useCamera({
    sendFrame: (imageData, options) =>
      charsetError ? false : startFrame(imageData, options),
    options: conversionOptions,
    showToast,
  });

  // Picking a file replaces the camera as the source
  const { imagePath, imagePreview, imageName, isVideo, loadImage, clearImage } =
    useImageInput({ showToast, onLoad: camera.stop });

  useLivePreview({
    enabled:
      settingsLoaded && settings.livePreview && !charsetError && !camera.active,
    path: imagePath,
    options: conversionOptions,
    convert: start,
  });

  useShortcuts({
    onOpen: openFilePicker,
    onSave: () => handleSave(),
    onConvert: () => {
      if (imagePath && !isLoading) handleConvert();
    },
    onHistory: () => setShowGallery(true),
    onStop: camera.active ? camera.stop : stop,
    canStop: isLoading || camera.active,
  });

  // setter("width") is the callback a panel wants for its width control
  const setter = (key) => (value) => setSetting(key, value);

  const handleConvert = () => {
    if (charsetError) {
      showToast(charsetError, "error");
      return;
    }
    camera.stop();
    start(imagePath, conversionOptions);
  };

  // What gets saved, copied or shown in a widget. `ascii` is the first frame
  // for a GIF (used by the single-picture formats).
  const artPayload = () => ({
    ascii: art.ascii,
    isGif: art.isGif,
    frames: art.frames,
    delays: art.delays,
  });

  const handleSave = async () => {
    if (!art.ascii) return;

    const result = await saveArt(artPayload(), {
      onProgress: (done, total) =>
        showToast(`Drawing frame ${done}/${total}...`, "info"),
    });

    if (result.error) {
      showToast(`Save failed: ${result.error}`, "error");
    } else if (!result.canceled) {
      showToast(`Saved to ${result.filePath}`, "info");
    }
  };

  const handleCopy = async () => {
    if (!art.ascii) return;

    const result = await ascart.copyText(artPayload());
    if ("error" in result) {
      showToast(`Copy failed: ${result.error}`, "error");
    } else {
      showToast("Copied the text to the clipboard", "info");
    }
  };

  const handleWidget = () => {
    if (!art.ascii) return;
    ascart.openWidget(artPayload());
  };

  const handleLoadFromGallery = (ascii, options, isGif, frames, delays) => {
    camera.stop();
    showArt(ascii, { isGif, frames, delays });
    if (options) restoreOptions(options);

    // The art no longer belongs to the image that is loaded, and live preview
    // would otherwise replace it with a conversion of that older image.
    clearImage();
  };

  // Live preview skips GIFs, videos and background removal, and never keeps
  // anything in history: that is what Convert is for
  const needsConvert =
    !!imagePath &&
    (!settings.livePreview ||
      isAnimatedPath(imagePath) ||
      settings.removeBackground);

  const size = artSize(art.ascii);
  const summary = size
    ? [
        `${size.cols} × ${size.rows}`,
        art.isGif && art.frames.length > 1 && `${art.frames.length} frames`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const status = camera.active
    ? "camera"
    : isLoading
      ? "converting"
      : imagePath && !needsConvert
        ? "live"
        : "ready";

  return (
    <MainLayout
      title={camera.active ? "camera" : imageName}
      statusBar={
        <StatusBar
          state={status}
          progress={progress}
          details={
            art.ascii ? [settings.charset, settings.colorScheme] : undefined
          }
        />
      }
    >
      <div className="workspace">
        <aside className="sidebar" aria-label="Settings">
          <div className="sidebar-scroll">
            <InputPanel
              onLoadImage={loadImage}
              removeBackground={settings.removeBackground}
              setRemoveBackground={setter("removeBackground")}
              imagePreview={imagePreview}
              imageName={imageName}
              isVideo={isVideo}
              cameraActive={camera.active}
              cameraStarting={camera.starting}
              onToggleCamera={camera.active ? camera.stop : camera.start}
            />
            <StylePanel
              width={settings.width}
              setWidth={setter("width")}
              ratio={settings.ratio}
              setRatio={setter("ratio")}
              keepOriginal={settings.keepOriginal}
              setKeepOriginal={setter("keepOriginal")}
              charset={settings.charset}
              setCharset={setter("charset")}
              customChars={settings.customChars}
              setCustomChars={setter("customChars")}
              customCharsError={charsetError}
              colorScheme={settings.colorScheme}
              setColorScheme={setter("colorScheme")}
            />
            <AdjustmentPanel
              invert={settings.invert}
              setInvert={setter("invert")}
              dither={settings.dither}
              setDither={setter("dither")}
              brightness={settings.brightness}
              setBrightness={setter("brightness")}
              contrast={settings.contrast}
              setContrast={setter("contrast")}
              onReset={resetAdjustments}
            />
          </div>
          <div className="sidebar-footer">
            <Switch
              label="Live preview"
              title="Convert again after every change"
              checked={settings.livePreview}
              onChange={setter("livePreview")}
            />
            <Button
              variant={needsConvert ? "primary" : "outline"}
              onClick={handleConvert}
              disabled={!imagePath || isLoading}
              shortcut="Ctrl+Enter"
              title="Convert and keep it in history"
              icon={<Icon name="convert" />}
            >
              {isLoading ? "Converting…" : "Convert"}
            </Button>
          </div>
        </aside>

        <section className="stage-area" aria-label="Art">
          <Toolbar
            summary={summary}
            hasArt={!!art.ascii}
            onSave={handleSave}
            onCopy={handleCopy}
            onWidget={handleWidget}
            onHistory={() => setShowGallery(true)}
          />
          <OutputViewer
            asciiArt={art.ascii}
            isLoading={isLoading}
            progress={progress}
            isGif={art.isGif}
            gifFrames={art.frames}
            gifDelays={art.delays}
            onStopProcessing={stop}
          />
        </section>
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />

      {showGallery && (
        <GalleryView
          onClose={() => setShowGallery(false)}
          onLoadAscii={handleLoadFromGallery}
        />
      )}
    </MainLayout>
  );
}

export default App;
