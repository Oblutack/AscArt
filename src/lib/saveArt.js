import { ascart } from "../ascart";
import { artToGif, artToPng } from "./renderArt";

const extensionOf = (/** @type {string} */ filePath) =>
  (/\.[^.\\/]+$/.exec(filePath)?.[0] ?? "").toLowerCase();

/**
 * Asks where to save, then writes the art in the format the file name asks
 * for: html, txt and ans are built by the main process, png and gif are
 * drawn here (this is where the canvas is) and written as bytes.
 *
 * @param {import("../types").ArtPayload} art
 * @param {{ onProgress?: (done: number, total: number) => void }} [options]
 * @returns {Promise<import("../types").SaveResult>}
 */
export async function saveArt(art, { onProgress } = {}) {
  const choice = await ascart.chooseSavePath({
    isGif: art.isGif && art.frames.length > 1,
  });
  if (choice.canceled) return { canceled: true };

  const { filePath } = choice;
  const extension = extensionOf(filePath);

  try {
    if (extension === ".png") {
      return await ascart.saveBinary(filePath, await artToPng(art.ascii));
    }
    if (extension === ".gif") {
      const frames = art.frames.length > 0 ? art.frames : [art.ascii];
      const bytes = await artToGif(frames, art.delays, onProgress);
      return await ascart.saveBinary(filePath, bytes);
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  return ascart.saveAscii(art, filePath);
}
