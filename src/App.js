import React, { useCallback, useEffect, useRef, useState } from "react";
import MainLayout from "./layouts/MainLayout";
import InputPanel from "./components/Generator/InputPanel";
import WidthPanel from "./components/Generator/WidthPanel";
import AdjustmentPanel from "./components/Generator/AdjustmentPanel";
import OutputViewer from "./components/Generator/OutputViewer";
import ActionButtons from "./components/Generator/ActionButtons";
import GalleryView from "./components/Gallery/GalleryView";
import Toast from "./components/Shared/Toast";

// Provided by electron/preload.js
const ascart = window.ascart;

const DEFAULT_SETTINGS = {
  removeBackground: false,
  width: 120,
  ratio: "--",
  keepOriginal: false,
  charset: "detailed",
  colorScheme: "original",
  invert: false,
  dither: false,
  brightness: 0,
  contrast: 100,
};

// Only the keys we know about are restored, so old or odd files can't inject junk
const pickSettings = (saved) =>
  Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS)
      .filter((key) => saved && saved[key] !== undefined && saved[key] !== null)
      .map((key) => [key, saved[key]])
  );

function App() {
  // Image & Processing State
  const [imagePreview, setImagePreview] = useState(null);
  const [imagePath, setImagePath] = useState(null);
  const [asciiArt, setAsciiArt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");
  const [progress, setProgress] = useState(null);
  const [toast, setToast] = useState(null);

  // Id of the conversion we are waiting for; late answers to older ones are ignored
  const activeRequest = useRef(null);
  const requestCounter = useRef(0);

  const showToast = useCallback(
    (message, kind = "info") => setToast({ id: Date.now(), message, kind }),
    []
  );
  const dismissToast = useCallback(() => setToast(null), []);

  // GIF Animation State
  const [isGif, setIsGif] = useState(false);
  const [gifFrames, setGifFrames] = useState([]);
  const [gifDelays, setGifDelays] = useState([]);

  // Settings State (one object, so persistence can't forget a field)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const {
    removeBackground,
    width,
    ratio,
    keepOriginal,
    charset,
    colorScheme,
    invert,
    dither,
    brightness,
    contrast,
  } = settings;
  const setter = (key) => (value) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  // Gallery State
  const [showGallery, setShowGallery] = useState(false);

  // Track if settings have been loaded to prevent overwriting on startup
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load saved settings on startup
  useEffect(() => {
    let cancelled = false;

    ascart.loadSettings().then((saved) => {
      if (cancelled) return;
      if (saved) {
        setSettings((prev) => ({ ...prev, ...pickSettings(saved) }));
      }
      // Mark settings as loaded (even if nothing was saved, so we know we tried)
      setSettingsLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Save settings when they change (but only after initial load)
  useEffect(() => {
    if (!settingsLoaded) return; // Don't save until settings are loaded

    ascart.saveSettings(settings);
  }, [settings, settingsLoaded]);

  useEffect(() => {
    // Listen for Python responses
    const handleResponse = (data) => {
      setDebugInfo(`Received: ${data.type || data.status}`);

      // Answers to a conversion we have since stopped or replaced
      const isStale =
        data.requestId !== undefined && data.requestId !== activeRequest.current;

      if (data.type === "progress") {
        if (!isStale) setProgress({ current: data.current, total: data.total });
      } else if (data.type === "ascii-result") {
        if (isStale) return;
        activeRequest.current = null;
        setAsciiArt(data.ascii);
        setIsGif(false);
        setGifFrames([]);
        setGifDelays([]);
        setIsLoading(false);
        setProgress(null);
      } else if (data.type === "gif-result") {
        if (isStale) return;
        activeRequest.current = null;
        setIsGif(true);
        setGifFrames(data.frames || []);
        setGifDelays(data.delays || []);
        setAsciiArt(data.frames?.[0] || "");
        setIsLoading(false);
        setProgress(null);
      } else if (data.type === "stopped") {
        setIsLoading(false);
        setProgress(null);
        showToast("Conversion stopped", "info");
      } else if (data.status === "error") {
        if (isStale) return;
        console.error("Python error:", data.error);
        activeRequest.current = null;
        setIsLoading(false);
        setProgress(null);
        showToast(data.error, "error");
      }
    };
    return ascart.onResponse(handleResponse);
  }, [showToast]);

  const handleLoadImage = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setImagePath(ascart.getPathForFile(file));
    };
    reader.readAsDataURL(file);
  }, []);

  // Accept dropped images anywhere in the window. Without this, a drop
  // outside the preview box would make the window navigate to the file.
  useEffect(() => {
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const image = files.find((file) => file.type.startsWith("image/"));
      if (image) {
        handleLoadImage(image);
      } else {
        showToast("That file is not an image", "error");
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleLoadImage, showToast]);

  const generateAsciiArt = (path = imagePath) => {
    if (!path) {
      console.warn("⚠️ No image path provided");
      return;
    }

    console.log("🚀 Generating ASCII art with options:");
    const options = {
      width: width,
      charset: charset,
      colorScheme: colorScheme,
      removeBackground: removeBackground,
      brightness: brightness,
      contrast: contrast,
      invert: invert,
      dither: dither,
      ratio: ratio !== "--" ? ratio : null,
      keepOriginal: keepOriginal,
    };
    console.log("   Path:", path);
    console.log("   Options:", options);

    if (removeBackground && path.toLowerCase().endsWith(".gif")) {
      showToast("Background removal on a GIF runs per frame and can take a while", "info");
    }

    const requestId = ++requestCounter.current;
    activeRequest.current = requestId;
    setProgress(null);
    setIsLoading(true);

    // Send command to Python backend
    ascart.convert(requestId, path, options);
    console.log("📤 Sent to Python backend");
  };

  // Manual conversion only - no auto-regeneration
  const handleConvert = () => {
    if (imagePath) {
      console.log("🔄 Manual conversion triggered");
      generateAsciiArt();
    }
  };

  const handleStopProcessing = () => {
    console.log("🛑 Stopping current processing");
    activeRequest.current = null;
    setIsLoading(false);
    setProgress(null);
    ascart.stop();
  };

  const handleReset = () => {
    console.log("🔄 Resetting adjustments");
    const { brightness, contrast, invert, dither } = DEFAULT_SETTINGS;
    setSettings((prev) => ({ ...prev, brightness, contrast, invert, dither }));
  };

  const handleSave = async () => {
    if (!asciiArt) return;

    const result = await ascart.saveAscii({
      ascii: asciiArt, // first frame for GIFs (used for plain text)
      isGif,
      frames: isGif ? gifFrames : [],
      delays: isGif ? gifDelays : [],
    });

    if (result.error) {
      showToast(`Save failed: ${result.error}`, "error");
    } else if (!result.canceled) {
      showToast(`Saved to ${result.filePath}`, "info");
    }
  };

  const handleWidget = () => {
    if (!asciiArt) {
      console.warn("⚠️ No ASCII art to display in widget");
      return;
    }
    console.log("🪟 Opening widget window");

    // Send widget data with GIF support
    const widgetData = {
      isGif: isGif,
      ascii: asciiArt,
      frames: isGif ? gifFrames : [],
      delays: isGif ? gifDelays : [],
    };

    ascart.openWidget(widgetData);
  };

  const handleHistory = () => {
    console.log("📜 Opening gallery");
    setShowGallery(true);
  };

  const handleLoadFromGallery = (ascii, options, isGifItem, frames, delays) => {
    console.log("🖼️ Loading from gallery", {
      isGifItem,
      frameCount: frames?.length,
    });

    // Restore GIF state if it's a GIF
    if (isGifItem && frames && delays) {
      setIsGif(true);
      setGifFrames(frames);
      setGifDelays(delays);
      setAsciiArt(frames[0] || ascii); // Use first frame
    } else {
      setIsGif(false);
      setGifFrames([]);
      setGifDelays([]);
      setAsciiArt(ascii);
    }

    // Restore options
    // (history stores ratio as null for "--", which pickSettings skips)
    if (options) {
      setSettings({ ...DEFAULT_SETTINGS, ...pickSettings(options) });
    }
  };

  const handleQuit = () => {
    console.log("👋 Quitting application");
    ascart.quit();
  };

  return (
    <MainLayout>
      {process.env.NODE_ENV === "development" && debugInfo && (
        <div
          style={{
            position: "fixed",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.8)",
            color: "#00ff00",
            padding: "10px",
            borderRadius: "5px",
            fontSize: "12px",
            zIndex: 9999,
            fontFamily: "monospace",
          }}
        >
          {debugInfo}
        </div>
      )}
      <div className="generator-grid">
        <div className="left-sidebar">
          <InputPanel
            onLoadImage={handleLoadImage}
            removeBackground={removeBackground}
            setRemoveBackground={setter("removeBackground")}
            imagePreview={imagePreview}
          />
          <ActionButtons
            onConvert={handleConvert}
            onSave={handleSave}
            onWidget={handleWidget}
            onHistory={handleHistory}
            onQuit={handleQuit}
            disabled={!asciiArt}
            hasImage={!!imagePath}
            isLoading={isLoading}
          />
          <WidthPanel
            width={width}
            setWidth={setter("width")}
            ratio={ratio}
            setRatio={setter("ratio")}
            keepOriginal={keepOriginal}
            setKeepOriginal={setter("keepOriginal")}
            charset={charset}
            setCharset={setter("charset")}
            colorScheme={colorScheme}
            setColorScheme={setter("colorScheme")}
          />
          <AdjustmentPanel
            invert={invert}
            setInvert={setter("invert")}
            dither={dither}
            setDither={setter("dither")}
            brightness={brightness}
            setBrightness={setter("brightness")}
            contrast={contrast}
            setContrast={setter("contrast")}
            onReset={handleReset}
          />
        </div>

        <OutputViewer
          asciiArt={asciiArt}
          isLoading={isLoading}
          progress={progress}
          isGif={isGif}
          gifFrames={gifFrames}
          gifDelays={gifDelays}
          onStopProcessing={handleStopProcessing}
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
