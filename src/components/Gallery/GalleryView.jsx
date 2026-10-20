import { useEffect, useRef, useState } from "react";

import { ascart } from "../../ascart";

const GalleryView = ({ onClose, onLoadAscii }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);

  const [isOpening, setIsOpening] = useState(false);

  // The latest callbacks, so the subscription below can stay put
  const callbacks = useRef({ onClose, onLoadAscii });
  useEffect(() => {
    callbacks.current = { onClose, onLoadAscii };
  });

  useEffect(() => {
    // Listen for the backend, then ask for the history list
    const unsubscribe = ascart.onResponse((data) => {
      if (data.type === "history") {
        setHistory(data.history);
        setIsLoading(false);
      } else if (data.type === "history-entry") {
        // The full art of the entry that was selected
        const { entry } = data;
        callbacks.current.onLoadAscii?.(
          entry.ascii,
          entry.options,
          entry.isGif,
          entry.frames,
          entry.delays,
        );
        callbacks.current.onClose();
      } else if (data.status === "error") {
        // The app shows the error; just don't spin forever
        setIsLoading(false);
        setIsOpening(false);
      }
    });
    ascart.getHistory();

    return unsubscribe;
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

  // Keyboard: Space or Enter adds/removes the tile, like Ctrl+click
  const handleItemKeyDown = (item, event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    setSelectedItems((current) =>
      current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item],
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === history.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...history]);
    }
  };

  // The list only has thumbnails; fetch the full art of the selected entry
  const handleLoadItem = () => {
    if (selectedItems.length !== 1) return;
    setIsOpening(true);
    ascart.getHistoryEntry(selectedItems[0].id);
  };

  const handleDeleteItems = () => {
    if (selectedItems.length === 0) return;

    ascart.deleteHistory(selectedItems.map((item) => item.id));

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
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`gallery-item ${
                    selectedItems.includes(item) ? "selected" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedItems.includes(item)}
                  aria-label={`${formatDate(item.timestamp)}, ${item.options.width} characters wide`}
                  onClick={(e) => handleItemClick(item, e)}
                  onKeyDown={(e) => handleItemKeyDown(item, e)}
                >
                  <div className="gallery-item-preview">
                    <pre
                      dangerouslySetInnerHTML={{ __html: item.thumb || "" }}
                    />
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
                disabled={selectedItems.length !== 1 || isOpening}
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
