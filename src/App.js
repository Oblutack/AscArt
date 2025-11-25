import React, { useEffect, useState } from "react";
import MainLayout from "./layouts/MainLayout";
import InputPanel from "./components/Generator/InputPanel";
import WidthPanel from "./components/Generator/WidthPanel";
import StylePanel from "./components/Generator/StylePanel";
import AdjustmentPanel from "./components/Generator/AdjustmentPanel";
import OutputViewer from "./components/Generator/OutputViewer";
import ActionButtons from "./components/Generator/ActionButtons";

const { ipcRenderer } = window.require("electron");

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

  // Settings State
  const [removeBackground, setRemoveBackground] = useState(false);
  const [width, setWidth] = useState(120);
  const [ratio, setRatio] = useState("--");
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [charset, setCharset] = useState("detailed");
  const [invert, setInvert] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(100);

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
      console.log("✅ Image loaded, starting conversion...");

      // Auto-generate when image loads
      generateAsciiArt(file.path);
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
      removeBackground: removeBackground,
      brightness: brightness,
      contrast: contrast,
      invert: invert,
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

  // Regenerate when settings change
  useEffect(() => {
    if (imagePath) {
      console.log("⚙️ Settings changed, regenerating...");
      const timeout = setTimeout(() => {
        generateAsciiArt();
      }, 300); // Debounce
      return () => clearTimeout(timeout);
    }
  }, [
    width,
    charset,
    removeBackground,
    brightness,
    contrast,
    invert,
    ratio,
    keepOriginal,
  ]);

  const handleReset = () => {
    console.log("🔄 Resetting adjustments");
    setBrightness(0);
    setContrast(100);
    setInvert(false);
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
    console.log("🪟 Toggling widget mode");
    ipcRenderer.send("window-widget-mode");
  };

  const handleHistory = () => {
    console.log("📜 History clicked");
    // TODO: Open history view
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
            setRemoveBackground={setRemoveBackground}
            imagePreview={imagePreview}
          />
          <WidthPanel
            width={width}
            setWidth={setWidth}
            ratio={ratio}
            setRatio={setRatio}
            keepOriginal={keepOriginal}
            setKeepOriginal={setKeepOriginal}
          />
          <StylePanel charset={charset} setCharset={setCharset} />
          <AdjustmentPanel
            invert={invert}
            setInvert={setInvert}
            brightness={brightness}
            setBrightness={setBrightness}
            contrast={contrast}
            setContrast={setContrast}
            onReset={handleReset}
          />
        </div>

        <ActionButtons
          onSave={handleSave}
          onWidget={handleWidget}
          onHistory={handleHistory}
          onQuit={handleQuit}
          disabled={!asciiArt}
        />

        <OutputViewer
          asciiArt={asciiArt}
          isLoading={isLoading}
          isGif={isGif}
          gifFrames={gifFrames}
          gifDelays={gifDelays}
        />
      </div>
    </MainLayout>
  );
}

export default App;
