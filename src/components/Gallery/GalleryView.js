import React, { useEffect, useState } from "react";

const { ipcRenderer } = window.require("electron");

const GalleryView = ({ onClose, onLoadAscii }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);

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

  const handleItemClick = (item, event) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select with Ctrl/Cmd
      if (selectedItems.includes(item)) {
        setSelectedItems(selectedItems.filter((i) => i !== item));
      } else {
        setSelectedItems([...selectedItems, item]);
      }
    } else {
      // Single select
      setSelectedItems([item]);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === history.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...history]);
    }
  };

  const handleLoadItem = () => {
    if (selectedItems.length === 1 && onLoadAscii) {
      onLoadAscii(selectedItems[0].ascii, selectedItems[0].options);
    }
    onClose();
  };

  const handleDeleteItems = () => {
    if (selectedItems.length === 0) return;

    // Get indices of selected items (sorted in reverse to delete from end)
    const indices = selectedItems
      .map((item) => history.indexOf(item))
      .filter((index) => index !== -1)
      .sort((a, b) => b - a);

    // Send delete commands for each item
    indices.forEach((index) => {
      ipcRenderer.send("to-python", {
        command: "delete_history",
        index: index,
      });
    });

    // Update local state
    const newHistory = history.filter((item) => !selectedItems.includes(item));
    setHistory(newHistory);
    setSelectedItems([]);
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
          {history.length > 0 && (
            <button
              className="gallery-select-all-btn"
              onClick={handleSelectAll}
            >
              {selectedItems.length === history.length
                ? "Deselect All"
                : "Select All"}
            </button>
          )}
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
                    selectedItems.includes(item) ? "selected" : ""
                  }`}
                  onClick={(e) => handleItemClick(item, e)}
                >
                  <div className="gallery-item-preview">
                    <pre dangerouslySetInnerHTML={{ __html: item.ascii }} />
                  </div>
                  <div className="gallery-item-info">
                    <span className="gallery-item-date">
                      {formatDate(item.timestamp)}
                    </span>
                    <span className="gallery-item-settings">
                      {item.options.width}ch · {item.options.charset}
                    </span>
                  </div>
                  {selectedItems.includes(item) && (
                    <div className="gallery-item-checkmark">✓</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedItems.length > 0 && (
          <div className="gallery-footer">
            <button
              className="gallery-btn gallery-btn-delete"
              onClick={handleDeleteItems}
            >
              Delete ({selectedItems.length})
            </button>
            <div className="gallery-footer-right">
              <button
                className="gallery-btn gallery-btn-load"
                onClick={handleLoadItem}
                disabled={selectedItems.length !== 1}
                style={{ opacity: selectedItems.length !== 1 ? 0.5 : 1 }}
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
