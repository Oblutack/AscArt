import { GIFEncoder, applyPalette, quantize } from "gifenc";

// Draws the art (the HTML the backend produces) as pixels, for PNG and GIF.

const BACKGROUND = "#0b0c10"; // the stage behind the art (--bg-stage)
const DEFAULT_COLOR = "#d0d0d0"; // uncolored art (halftone)
const FONT_FAMILY =
  '"JetBrains Mono", "Courier New", Consolas, "DejaVu Sans Mono", monospace';

// A monospace glyph is about this much wider than the font size
const GLYPH_ASPECT = 0.6;

// The converters assume a character cell is 1/0.55 times as tall as it is wide,
// so lines are this many font sizes tall (0.6 / 0.55). Taller lines are what
// keep the art from looking squashed.
export const LINE_HEIGHT = 1.09;

/**
 * @typedef {{ text: string, color: string | null }} Run
 */

const unescapeEntities = (/** @type {string} */ text) =>
  text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/**
 * The art as rows of runs of text with one color each.
 * @param {string} markup
 * @returns {Run[][]}
 */
export function parseArt(markup) {
  const spanPattern =
    /<span style="color:rgb\((\d+),(\d+),(\d+)\)">([^<]*)<\/span>/g;

  return markup.split("\n").map((line) => {
    /** @type {Run[]} */
    const runs = [];
    let position = 0;

    for (const match of line.matchAll(spanPattern)) {
      if (match.index > position) {
        runs.push({
          text: unescapeEntities(line.slice(position, match.index)),
          color: null,
        });
      }
      runs.push({
        text: unescapeEntities(match[4]),
        color: `rgb(${match[1]},${match[2]},${match[3]})`,
      });
      position = match.index + match[0].length;
    }
    if (position < line.length) {
      runs.push({ text: unescapeEntities(line.slice(position)), color: null });
    }
    return runs;
  });
}

/** Number of columns of the widest row */
export const columnsOf = (/** @type {Run[][]} */ rows) =>
  Math.max(
    0,
    ...rows.map((row) =>
      row.reduce((sum, run) => sum + [...run.text].length, 0),
    ),
  );

/**
 * The largest font size (up to `preferred`) at which the art is no wider than
 * maxWidth pixels.
 * @param {number} columns
 * @param {number} maxWidth
 * @param {number} preferred
 */
export function fitFontSize(columns, maxWidth, preferred) {
  if (columns <= 0) return preferred;
  return Math.max(
    2,
    Math.min(preferred, Math.floor(maxWidth / (columns * GLYPH_ASPECT))),
  );
}

/**
 * Draws parsed art onto a new canvas.
 * @param {Run[][]} rows
 * @param {{ fontSize: number, scale?: number }} options
 */
export function drawArt(rows, { fontSize, scale = 1 }) {
  const size = fontSize * scale;
  const font = `${size}px ${FONT_FAMILY}`;

  const canvas = document.createElement("canvas");
  const context = /** @type {CanvasRenderingContext2D} */ (
    canvas.getContext("2d", { willReadFrequently: true })
  );
  context.font = font;
  const cellWidth = context.measureText("M").width;

  const padding = Math.round(size);
  canvas.width = Math.ceil(columnsOf(rows) * cellWidth) + padding * 2;
  const lineHeight = size * LINE_HEIGHT;
  canvas.height = Math.ceil(rows.length * lineHeight) + padding * 2;

  // Resizing a canvas resets its state
  context.font = font;
  context.textBaseline = "top";
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);

  rows.forEach((row, y) => {
    let x = padding;
    for (const run of row) {
      context.fillStyle = run.color ?? DEFAULT_COLOR;
      context.fillText(run.text, x, padding + y * lineHeight);
      x += [...run.text].length * cellWidth;
    }
  });

  return canvas;
}

/** @param {HTMLCanvasElement} canvas */
const canvasToBytes = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("The image could not be created"));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });

/**
 * One picture of the art, as PNG bytes. Drawn at twice the size so it stays
 * sharp when zoomed.
 * @param {string} markup
 * @returns {Promise<Uint8Array>}
 */
export async function artToPng(markup) {
  const rows = parseArt(markup);
  const canvas = drawArt(rows, { fontSize: 10, scale: 2 });
  return /** @type {Promise<Uint8Array>} */ (canvasToBytes(canvas));
}

const GIF_MAX_WIDTH = 720;

/**
 * An animated GIF of all the frames. Sized so a wide piece of art doesn't
 * make a huge file, and it gives the page a chance to breathe between frames.
 * @param {string[]} frames
 * @param {number[]} delays milliseconds
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function artToGif(frames, delays, onProgress) {
  const encoder = GIFEncoder();
  const parsed = frames.map(parseArt);
  const fontSize = fitFontSize(columnsOf(parsed[0] ?? []), GIF_MAX_WIDTH, 10);

  for (let i = 0; i < parsed.length; i++) {
    const canvas = drawArt(parsed[i], { fontSize });
    const context = /** @type {CanvasRenderingContext2D} */ (
      canvas.getContext("2d")
    );
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

    const palette = quantize(data, 256, { format: "rgb444" });
    const index = applyPalette(data, palette, "rgb444");
    encoder.writeFrame(index, canvas.width, canvas.height, {
      palette,
      delay: Math.max(20, delays[i] ?? 100),
    });

    onProgress?.(i + 1, parsed.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  encoder.finish();
  return encoder.bytes();
}
