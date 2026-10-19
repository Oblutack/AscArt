import React, { useEffect, useState } from "react";
import MainLayout from "./layouts/MainLayout";
import InputPanel from "./components/Generator/InputPanel";
import WidthPanel from "./components/Generator/WidthPanel";
import AdjustmentPanel from "./components/Generator/AdjustmentPanel";
import OutputViewer from "./components/Generator/OutputViewer";
import ActionButtons from "./components/Generator/ActionButtons";
import GalleryView from "./components/Gallery/GalleryView";

const { ipcRenderer } = window.require("electron");

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
    ipcRenderer.send("load-settings");

    ipcRenderer.on("settings-loaded", (event, saved) => {
      if (saved) {
        console.log("📂 Loading saved settings:", saved);
        setSettings((prev) => ({ ...prev, ...pickSettings(saved) }));
      }
      // Mark settings as loaded (even if null, so we know we tried)
      setSettingsLoaded(true);
    });

    return () => {
      ipcRenderer.removeAllListeners("settings-loaded");
    };
  }, []);

  // Save settings when they change (but only after initial load)
  useEffect(() => {
    if (!settingsLoaded) return; // Don't save until settings are loaded

    ipcRenderer.send("save-settings", settings);
  }, [settings, settingsLoaded]);

  useEffect(() => {
    // Listen for Python responses
    ipcRenderer.on("python-response", (event, data) => {
      console.log("📥 Received from Python:", data);
      setDebugInfo(
        `Received: ${data.type || data.status} | Length: ${
          data.ascii?.length || 0
        }`
      );

      if (data.type === "ascii-result") {
        console.log("✅ ASCII art received, length:", data.ascii?.length);
        console.log("First 100 chars:", data.ascii?.substring(0, 100));
        setAsciiArt(data.ascii);
        setIsGif(false);
        setGifFrames([]);
        setGifDelays([]);
        setIsLoading(false);
        console.log("State updated, isLoading:", false);
        setDebugInfo(`✅ ASCII loaded: ${data.ascii?.length} chars`);
      } else if (data.type === "gif-result") {
        console.log("🎬 GIF received:", data.frames?.length, "frames");
        setIsGif(true);
        setGifFrames(data.frames || []);
        setGifDelays(data.delays || []);
        setAsciiArt(data.frames?.[0] || "");
        setIsLoading(false);
        setDebugInfo(`🎬 GIF loaded: ${data.frames?.length} frames`);
      } else if (data.error) {
        console.error("❌ Python Error:", data.error);
        setIsLoading(false);
        setDebugInfo(`❌ Error: ${data.error}`);
        alert(`Error: ${data.error}`);
      } else if (data.status === "success" && data.message) {
        console.log("ℹ️ Python message:", data.message);
        setDebugInfo(`ℹ️ ${data.message}`);
      }
    });

    return () => {
      ipcRenderer.removeAllListeners("python-response");
    };
  }, []);

  const handleLoadImage = (file) => {
    console.log("🖼️ Loading image:", file.path);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setImagePath(file.path);
      console.log("✅ Image loaded - ready to convert");
    };
    reader.readAsDataURL(file);
  };

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

    setIsLoading(true);

    // Send command to Python backend
    ipcRenderer.send("to-python", {
      command: "convert",
      path: path,
      options: options,
    });
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
    setIsLoading(false);
    ipcRenderer.send("to-python", {
      command: "stop",
    });
  };

  const handleReset = () => {
    console.log("🔄 Resetting adjustments");
    const { brightness, contrast, invert, dither } = DEFAULT_SETTINGS;
    setSettings((prev) => ({ ...prev, brightness, contrast, invert, dither }));
  };

  const handleSave = () => {
    if (!asciiArt) {
      console.warn("⚠️ No ASCII art to save");
      return;
    }

    console.log("💾 Saving ASCII art...");
    ipcRenderer.send("to-python", {
      command: "save",
      ascii: asciiArt,
      filename: `ascii_${Date.now()}.txt`,
    });
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

    ipcRenderer.send("open-widget", widgetData);
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
    ipcRenderer.send("window-close");
  };

  return (
    <MainLayout>
      {debugInfo && (
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
          isGif={isGif}
          gifFrames={gifFrames}
          gifDelays={gifDelays}
          onStopProcessing={handleStopProcessing}
        />
      </div>

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
