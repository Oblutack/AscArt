import React from "react";

const MainLayout = ({ children }) => {
  return (
    <div className="main-layout">
      <header className="app-header draggable">
        <h1 className="app-title">
          <span className="title-main">AscArt</span>
          <span className="title-subtitle">// Image & GIF Converter</span>
        </h1>
        <div className="drag-hint no-drag">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Drag & Drop files here
        </div>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
};

export default MainLayout;
