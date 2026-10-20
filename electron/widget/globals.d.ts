// What widget-preload.js exposes to the widget page (widget.js)

interface WidgetData {
  isGif: boolean;
  ascii: string;
  frames: string[];
  delays: number[];
}

interface WidgetApi {
  onData(callback: (data: WidgetData) => void): void;
  close(): void;
  moveBy(deltaX: number, deltaY: number): void;
}

interface Window {
  widgetApi: WidgetApi;
}
