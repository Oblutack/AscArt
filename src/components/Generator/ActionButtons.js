import React from "react";
import Button from "../Shared/Button";

const ActionButtons = ({ onSave, onWidget, onHistory, onQuit, disabled }) => {
  return (
    <div className="panel actions-panel">
      <div className="panel-header">ACTIONS</div>
      <div className="actions-buttons">
        <Button
          variant="save"
          fullWidth
          onClick={onSave}
          disabled={disabled}
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          }
        >
          SAVE
        </Button>
        <Button
          variant="widget"
          fullWidth
          onClick={onWidget}
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          }
        >
          WIDGET
        </Button>
        <Button
          variant="history"
          fullWidth
          onClick={onHistory}
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        >
          HISTORY
        </Button>
        <Button
          variant="quit"
          fullWidth
          onClick={onQuit}
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          }
        >
          QUIT
        </Button>
      </div>
    </div>
  );
};

export default ActionButtons;
