import React, { useEffect, useState } from "react";

const { ipcRenderer } = window.require("electron");

const GalleryView = ({ onClose, onLoadAscii }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    // Request history from Python backend
    ipcRenderer.send("to-python", {
      command: "get_history",
    });

    // Listen for history response
    const handleResponse = (event, data) => {
      if (data.status === "success" && data.history) {
        setHistory(data.history);
        setIsLoading(false);
      }
    };

    ipcRenderer.on("python-response", handleResponse);

    return () => {
      ipcRenderer.removeListener("python-response", handleResponse);
    };
  }, []);

  const handleItemClick = (item) => {
    setSelectedItem(item);
  };

  const handleLoadItem = () => {
    if (selectedItem && onLoadAscii) {
      onLoadAscii(selectedItem.ascii, selectedItem.options);
    }
    onClose();
  };

  const handleDeleteItem = () => {
    if (!selectedItem) return;

    const itemIndex = history.indexOf(selectedItem);
    if (itemIndex === -1) return;

    // Send delete command to Python
    ipcRenderer.send("to-python", {
      command: "delete_history",
      index: itemIndex,
    });

    // Update local state
    const newHistory = history.filter((item) => item !== selectedItem);
    setHistory(newHistory);
    setSelectedItem(null);
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div className="gallery-overlay">
      <div className="gallery-modal">
        <div className="gallery-header">
          <h2>History / Gallery</h2>
          <button className="gallery-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="gallery-content">
          {isLoading ? (
            <div className="gallery-loading">
              <div className="loading-spinner"></div>
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="gallery-empty">
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
              <p>No history yet</p>
              <p className="gallery-empty-subtitle">
                Convert some images to see them here
              </p>
            </div>
          ) : (
            <div className="gallery-grid">
              {history.map((item, index) => (
                <div
                  key={index}
                  className={`gallery-item ${
                    selectedItem === item ? "selected" : ""
                  }`}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="gallery-item-preview">
                    <pre>{item.ascii}</pre>
                  </div>
                  <div className="gallery-item-info">
                    <span className="gallery-item-date">
                      {formatDate(item.timestamp)}
                    </span>
                    <span className="gallery-item-settings">
                      {item.options.width}ch · {item.options.charset}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedItem && (
          <div className="gallery-footer">
            <button
              className="gallery-btn gallery-btn-delete"
              onClick={handleDeleteItem}
            >
              Delete
            </button>
            <div className="gallery-footer-right">
              <button
                className="gallery-btn gallery-btn-load"
                onClick={handleLoadItem}
              >
                Load Selected
              </button>
              <button
                className="gallery-btn gallery-btn-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryView;
