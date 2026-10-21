import { ascart } from "../ascart";
import Icon from "../components/Shared/Icon";

/**
 * The window: a title bar you can drag the window by, the content, and the
 * status bar.
 *
 * @param {{
 *   title?: string | null,
 *   statusBar?: import("react").ReactNode,
 *   children: import("react").ReactNode,
 * }} props
 */
const MainLayout = ({ title, statusBar, children }) => (
  <div className="app-window">
    <header className="title-bar draggable">
      <h1 className="wordmark">ascart</h1>
      {title && (
        <>
          <span className="title-separator" aria-hidden="true">
            /
          </span>
          <span className="title-name">{title}</span>
        </>
      )}
      <div className="window-controls no-drag">
        <button
          type="button"
          className="window-btn"
          onClick={() => ascart.minimize()}
          title="Minimize"
          aria-label="Minimize"
        >
          <Icon name="minus" />
        </button>
        <button
          type="button"
          className="window-btn window-btn-close"
          onClick={() => ascart.quit()}
          title="Close"
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
      </div>
    </header>
    <main className="app-content">{children}</main>
    {statusBar}
  </div>
);

export default MainLayout;
