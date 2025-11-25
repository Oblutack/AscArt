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
      console.log("Received from Python:", data);

      if (data.type === "ascii-result") {
        setAsciiArt(data.ascii);
        setIsLoading(false);
      } else if (data.error) {
        console.error("Python Error:", data.error);
        setIsLoading(false);
      }
    });

    return () => {
      ipcRenderer.removeAllListeners("python-response");
    };
  }, []);

  const handleLoadImage = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setImagePath(file.path);

      // Auto-generate when image loads
      generateAsciiArt(file.path);
    };
    reader.readAsDataURL(file);
  };

  const generateAsciiArt = (path = imagePath) => {
    if (!path) return;

    setIsLoading(true);

    // Send command to Python backend
    ipcRenderer.send("to-python", {
      command: "convert",
      path: path,
      options: {
        width: width,
        charset: charset,
        removeBackground: removeBackground,
        brightness: brightness,
        contrast: contrast,
        invert: invert,
        ratio: ratio !== "--" ? ratio : null,
        keepOriginal: keepOriginal,
      },
    });
  };

  // Regenerate when settings change
  useEffect(() => {
    if (imagePath) {
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
    setBrightness(0);
    setContrast(100);
    setInvert(false);
  };

  const handleSave = () => {
    if (!asciiArt) return;

    ipcRenderer.send("to-python", {
      command: "save",
      ascii: asciiArt,
      filename: `ascii_${Date.now()}.txt`,
    });
  };

  const handleWidget = () => {
    ipcRenderer.send("window-widget-mode");
  };

  const handleHistory = () => {
    // TODO: Open history view
    console.log("History clicked");
  };

  const handleQuit = () => {
    ipcRenderer.send("window-close");
  };

  return (
    <MainLayout>
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

        <OutputViewer asciiArt={asciiArt} isLoading={isLoading} />
      </div>
    </MainLayout>
  );
}

export default App;
