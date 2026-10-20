import { useState } from "react";
import { ascart } from "./ascart";
import { useConversion } from "./hooks/useConversion";
import { useImageInput } from "./hooks/useImageInput";
import { useLivePreview } from "./hooks/useLivePreview";
import { useSettings } from "./hooks/useSettings";
import { useShortcuts } from "./hooks/useShortcuts";
import { useToast } from "./hooks/useToast";
import MainLayout from "./layouts/MainLayout";
import InputPanel from "./components/Generator/InputPanel";
import WidthPanel from "./components/Generator/WidthPanel";
import AdjustmentPanel from "./components/Generator/AdjustmentPanel";
import OutputViewer from "./components/Generator/OutputViewer";
import ActionButtons from "./components/Generator/ActionButtons";
import GalleryView from "./components/Gallery/GalleryView";
import Toast from "./components/Shared/Toast";
import { customCharsError } from "./lib/customChars";
import { openFilePicker } from "./lib/dom";
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
  const { imagePath, imagePreview, imageName, isVideo, loadImage, clearImage } =
    useImageInput({ showToast });
  const { art, isLoading, progress, start, stop, showArt } = useConversion({
    showToast,
  });
  const [showGallery, setShowGallery] = useState(false);

  // A half-typed character set shouldn't be sent to the backend
  const charsetError =
    settings.charset === "custom"
      ? customCharsError(settings.customChars)
      : null;

  useLivePreview({
    enabled: settingsLoaded && settings.livePreview && !charsetError,
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
    onStop: stop,
    canStop: isLoading,
  });

  // setter("width") is the callback a panel wants for its width control
  const setter = (key) => (value) => setSetting(key, value);

  const handleConvert = () => {
    if (charsetError) {
      showToast(charsetError, "error");
      return;
    }
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
    showArt(ascii, { isGif, frames, delays });
    if (options) restoreOptions(options);

    // The art no longer belongs to the image that is loaded, and live preview
    // would otherwise replace it with a conversion of that older image.
    clearImage();
  };

  return (
    <MainLayout>
      <div className="generator-grid">
        <div className="left-sidebar">
          <InputPanel
            onLoadImage={loadImage}
            removeBackground={settings.removeBackground}
            setRemoveBackground={setter("removeBackground")}
            livePreview={settings.livePreview}
            setLivePreview={setter("livePreview")}
            imagePreview={imagePreview}
            imageName={imageName}
            isVideo={isVideo}
          />
          <ActionButtons
            onConvert={handleConvert}
            onSave={handleSave}
            onCopy={handleCopy}
            onWidget={handleWidget}
            onHistory={() => setShowGallery(true)}
            onQuit={() => ascart.quit()}
            disabled={!art.ascii}
            hasImage={!!imagePath}
            isLoading={isLoading}
          />
          <WidthPanel
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

        <OutputViewer
          asciiArt={art.ascii}
          isLoading={isLoading}
          progress={progress}
          isGif={art.isGif}
          gifFrames={art.frames}
          gifDelays={art.delays}
          onStopProcessing={stop}
        />
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
