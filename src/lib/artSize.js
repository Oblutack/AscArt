/**
 * The size of a piece of art (the HTML the backend produces) in characters.
 * Colours are <span> tags and <, > and & are escaped, so those are counted as
 * the one character they show.
 *
 * @param {string | null | undefined} markup
 * @returns {{ cols: number, rows: number } | null}
 */
export function artSize(markup) {
  if (!markup) return null;
  const lines = markup.replace(/\n$/, "").split("\n");
  const cols = Math.max(
    ...lines.map(
      (line) =>
        [...line.replace(/<[^>]*>/g, "").replace(/&lt;|&gt;|&amp;/g, "x")]
          .length,
    ),
  );
  return { cols, rows: lines.length };
}
