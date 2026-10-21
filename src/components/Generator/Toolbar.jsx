import Button from "../Shared/Button";
import Icon from "../Shared/Icon";

/**
 * The bar above the art: what is on screen, and what can be done with it.
 *
 * @param {{
 *   summary?: string,
 *   hasArt: boolean,
 *   onSave: () => void,
 *   onCopy: () => void,
 *   onWidget: () => void,
 *   onHistory: () => void,
 * }} props
 */
const Toolbar = ({ summary, hasArt, onSave, onCopy, onWidget, onHistory }) => (
  <div className="toolbar" role="toolbar" aria-label="Art">
    <span className="toolbar-summary">{summary}</span>
    <div className="toolbar-actions">
      <Button
        variant="ghost"
        onClick={onCopy}
        disabled={!hasArt}
        title="Copy the characters to the clipboard"
        icon={<Icon name="copy" />}
      >
        Copy
      </Button>
      <Button
        variant="ghost"
        onClick={onWidget}
        disabled={!hasArt}
        title="Put the art on your desktop"
        icon={<Icon name="widget" />}
      >
        Widget
      </Button>
      <Button
        variant="ghost"
        onClick={onHistory}
        shortcut="Ctrl+H"
        icon={<Icon name="history" />}
      >
        History
      </Button>
      <Button
        variant="primary"
        onClick={onSave}
        disabled={!hasArt}
        shortcut="Ctrl+S"
        title="Save as HTML, text, ANSI, PNG or GIF"
        icon={<Icon name="save" />}
      >
        Save
      </Button>
    </div>
  </div>
);

export default Toolbar;
