// Types for what crosses the process boundary. They describe the messages in
// BACKEND_DOCS.md and the API electron/preload.js exposes; nothing here exists
// at runtime.

export interface ConversionOptions {
  width: number;
  charset: string;
  /** The ramp, dark to light, when charset is "custom" */
  customChars?: string;
  colorScheme: string;
  removeBackground: boolean;
  brightness: number;
  contrast: number;
  invert: boolean;
  dither: boolean;
  /** "16:9" and so on, or null for the image's own ratio */
  ratio: string | null;
  keepOriginal: boolean;
}

/** Everything the user can set, including the one that isn't a conversion option. */
export interface Settings extends Omit<ConversionOptions, "ratio"> {
  /** "--" means no ratio */
  ratio: string;
  livePreview: boolean;
}

export interface HistoryEntrySummary {
  id: string;
  timestamp: string;
  options: Partial<ConversionOptions>;
  isGif: boolean;
  /** HTML of a small version of the art */
  thumb: string;
}

export interface HistoryEntry extends HistoryEntrySummary {
  ascii: string;
  frames?: string[];
  delays?: number[];
}

/** What the page sends to the widget and to Save As */
export interface ArtPayload {
  ascii: string;
  isGif: boolean;
  frames: string[];
  delays: number[];
}

/** Messages from the Python backend (and a few from Electron itself) */
export type BackendMessage =
  | { status: "success"; type: "pong"; message: string; requestId?: number }
  | {
      status: "success";
      type: "ascii-result";
      ascii: string;
      isGif: false;
      requestId?: number;
    }
  | {
      status: "success";
      type: "gif-result";
      frames: string[];
      delays: number[];
      frameCount: number;
      requestId?: number;
    }
  | {
      status: "success";
      type: "progress";
      current: number;
      total: number;
      requestId?: number;
    }
  | { status: "success"; type: "cancelled"; requestId?: number }
  | { status: "success"; type: "stopped" }
  | {
      status: "success";
      type: "history";
      history: HistoryEntrySummary[];
      requestId?: number;
    }
  | {
      status: "success";
      type: "history-entry";
      entry: HistoryEntry;
      requestId?: number;
    }
  | { status: "success"; type: "deleted"; removed: number; requestId?: number }
  | { status: "error"; type?: undefined; error: string; requestId?: number };

export type SaveResult =
  | { filePath: string; canceled?: undefined; error?: undefined }
  | { canceled: true; filePath?: undefined; error?: undefined }
  | { error: string; filePath?: undefined; canceled?: undefined };

/** window.ascart, exposed by electron/preload.js */
export interface AscartApi {
  convert(
    requestId: number,
    path: string,
    options: ConversionOptions,
    saveHistory?: boolean,
  ): void;
  stop(requestId?: number | null): void;
  getHistory(): void;
  getHistoryEntry(id: string): void;
  deleteHistory(ids: string[]): void;
  /** Subscribe to the backend; returns the function that unsubscribes */
  onResponse(callback: (message: BackendMessage) => void): () => void;

  /** The Save As dialog, with every format; the extension picks the format */
  chooseSavePath(options: {
    isGif: boolean;
  }): Promise<
    | { filePath: string; canceled?: undefined }
    | { canceled: true; filePath?: undefined }
  >;
  /** Writes html, txt or ans (chosen by the file's extension) */
  saveAscii(art: ArtPayload, filePath: string): Promise<SaveResult>;
  /** Writes an image the page drew (png or gif) */
  saveBinary(filePath: string, bytes: Uint8Array): Promise<SaveResult>;
  copyText(art: ArtPayload): Promise<{ copied: true } | { error: string }>;
  loadSettings(): Promise<Partial<Settings> | null>;
  saveSettings(settings: Settings): void;
  getPathForFile(file: File): string;

  openWidget(data: ArtPayload): void;
  minimize(): void;
  quit(): void;
}

declare global {
  interface Window {
    ascart: AscartApi;
  }
}
