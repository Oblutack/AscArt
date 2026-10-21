import { useEffect, useRef, useState } from "react";

import { ascart } from "../../ascart";
import Button from "../Shared/Button";
import Icon from "../Shared/Icon";
import IconButton from "../Shared/IconButton";

const formatDate = (/** @type {string} */ isoString) =>
  new Date(isoString).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** The settings an entry was made with, in a few words */
const describeEntry = (
  /** @type {import("../../types").HistoryEntrySummary} */ item,
) =>
  [
    `${item.options.width} characters wide`,
    item.options.charset,
    item.options.colorScheme,
    item.isGif && "animation",
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * The history: every kept conversion with its settings. Opening one restores
 * its art and settings; entries can be deleted one at a time or all at once.
 */
const GalleryView = ({ onClose, onLoadAscii }) => {
  const [history, setHistory] = useState(
    /** @type {import("../../types").HistoryEntrySummary[]} */ ([]),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  // The latest callbacks, so the subscription below can stay put
  const callbacks = useRef({ onClose, onLoadAscii });
  useEffect(() => {
    callbacks.current = { onClose, onLoadAscii };
  });

  // As a dialog: take focus when opened, give it back when closed, and
  // close on Escape
  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();

    // Capture phase, so Escape closes the history instead of also stopping a
    // conversion running behind it
    const closeOnEscape = (/** @type {KeyboardEvent} */ event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      callbacks.current.onClose();
    };
    window.addEventListener("keydown", closeOnEscape, true);

    return () => {
      window.removeEventListener("keydown", closeOnEscape, true);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    // Listen for the backend, then ask for the history list
    const unsubscribe = ascart.onResponse((data) => {
      if (data.type === "history") {
        setHistory(data.history);
        setIsLoading(false);
      } else if (data.type === "history-entry") {
        // The full art of the entry that was opened
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

  // The list only has thumbnails; fetch the full art of the entry
  const openEntry = (item) => {
    setIsOpening(true);
    ascart.getHistoryEntry(item.id);
  };

  const deleteEntries = (items) => {
    ascart.deleteHistory(items.map((item) => item.id));
    setHistory((current) => current.filter((item) => !items.includes(item)));
  };

  const clearAll = () => {
    deleteEntries(history);
    setConfirmingClear(false);
  };

  return (
    <div
      className="history-view"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-title"
      tabIndex={-1}
      ref={dialogRef}
    >
      <div className="history-bar">
        <Button variant="ghost" onClick={onClose} icon={<Icon name="back" />}>
          Back to the art
        </Button>
        <h2 id="history-title" className="history-title">
          History
        </h2>
        {history.length > 0 && (
          <span className="history-count">{history.length} kept, up to 50</span>
        )}
        <span className="history-spacer" />
        {history.length > 0 &&
          (confirmingClear ? (
            <span className="history-confirm" role="group" aria-label="Clear">
              Delete all {history.length}?
              <Button variant="danger" onClick={clearAll}>
                Delete all
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingClear(false)}>
                Keep them
              </Button>
            </span>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingClear(true)}>
              Clear all…
            </Button>
          ))}
      </div>

      <div className="history-content">
        {isLoading ? (
          <div className="stage-message" role="status">
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill progress-indeterminate" />
            </div>
            <p>Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="stage-message">
            <Icon name="history" size={32} />
            <p className="stage-title">No history yet</p>
            <p>Every conversion you make with Convert is kept here</p>
          </div>
        ) : (
          <ul className="history-grid">
            {history.map((item) => {
              const description = `${formatDate(item.timestamp)}, ${describeEntry(item)}`;
              return (
                <li key={item.id} className="history-card">
                  <div className="history-thumb" aria-hidden="true">
                    <pre
                      dangerouslySetInnerHTML={{ __html: item.thumb || "" }}
                    />
                  </div>
                  <div className="history-info">
                    <div className="history-text">
                      <span className="history-date">
                        {formatDate(item.timestamp)}
                      </span>
                      <span className="history-meta">
                        {describeEntry(item)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => openEntry(item)}
                      disabled={isOpening}
                      aria-label={`Open ${description}`}
                    >
                      Open
                    </button>
                    <IconButton
                      title={`Delete ${description}`}
                      variant="danger"
                      onClick={() => deleteEntries([item])}
                    >
                      <Icon name="trash" />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GalleryView;
