// Turns the colored ASCII markup (one <span> per character) into files.

// The art only contains span tags and the characters from the charsets, none
// of which are HTML special characters, so removing tags is all it takes.
function stripTags(markup) {
  return markup.replace(/<[^>]*>/g, "");
}

// JSON embedded in a <script> must not contain a literal "<", or a stray
// "</script>" could end the script early.
function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const PAGE_STYLE = `
  body { margin: 0; padding: 20px; background: #0a0a0f; }
  pre {
    margin: 0;
    color: #d0d0d0;
    font-family: "Courier New", Consolas, monospace;
    font-size: 8px;
    line-height: 1;
    white-space: pre;
  }`;

/**
 * Standalone page. Animated GIFs get all frames plus a tiny player.
 * @param {{ ascii: string, isGif?: boolean, frames?: string[], delays?: number[] }} art
 */
function buildHtml({ ascii, isGif, frames = [], delays = [] }) {
  const animated = isGif && frames.length > 1;

  const body = animated
    ? `<pre id="art">${frames[0]}</pre>
<script>
  const frames = ${jsonForScript(frames)};
  const delays = ${jsonForScript(delays)};
  const art = document.getElementById("art");
  let current = 0;
  function next() {
    current = (current + 1) % frames.length;
    art.innerHTML = frames[current];
    setTimeout(next, Math.max(20, delays[current] || 100));
  }
  setTimeout(next, Math.max(20, delays[0] || 100));
</script>`
    : `<pre>${ascii}</pre>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ASCII Art</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

module.exports = { stripTags, buildHtml };
