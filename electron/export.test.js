const test = require("node:test");
const assert = require("node:assert/strict");
const { stripTags, toAnsi, buildHtml } = require("./export");

const cell = (char, rgb = "1,2,3") =>
  `<span style="color:rgb(${rgb})">${char}</span>`;

test("stripTags leaves just the characters and line breaks", () => {
  const art = `${cell("@")}${cell(" ", "4,5,6")}\n${cell("#")}`;
  assert.equal(stripTags(art), "@ \n#");
});

test("stripTags keeps block characters", () => {
  assert.equal(stripTags(`${cell("█")}${cell("▓")}`), "█▓");
});

test("static page shows the art in a pre", () => {
  const html = buildHtml({ ascii: cell("@"), isGif: false });
  assert.match(html, /<pre>.*@.*<\/pre>/s);
  assert.doesNotMatch(html, /<script>/);
});

test("animated page embeds every frame and delay", () => {
  const frames = [cell("a"), cell("b"), cell("c")];
  const html = buildHtml({
    ascii: frames[0],
    isGif: true,
    frames,
    delays: [40, 50, 60],
  });
  assert.match(html, /<script>/);
  assert.match(html, /const delays = \[40,50,60\];/);
  // "<" is written as < inside the script
  const embedded = JSON.stringify(frames).replace(/</g, "\\u003c");
  assert.ok(html.includes(`const frames = ${embedded};`));
});

test("a frame containing </script> cannot end the player script early", () => {
  const html = buildHtml({
    ascii: "x",
    isGif: true,
    frames: ["y", "</script><b>boom</b>"],
    delays: [10, 10],
  });
  assert.equal(html.match(/<\/script>/g).length, 1);
});

test("a single-frame gif is exported as a static page", () => {
  const html = buildHtml({
    ascii: cell("a"),
    isGif: true,
    frames: [cell("a")],
    delays: [50],
  });
  assert.doesNotMatch(html, /<script>/);
});

const ESC = String.fromCharCode(27);

test("stripTags brings escaped characters back", () => {
  assert.equal(stripTags(cell("&lt;&amp;&gt;")), "<&>");
  // "&amp;lt;" is the text "&lt;", not "<"
  assert.equal(stripTags("&amp;lt;"), "&lt;");
});

test("toAnsi turns spans into 24-bit color codes and resets every line", () => {
  const art = `${cell("@", "255,0,0")}${cell("#", "0,0,255")}\n${cell("%", "1,2,3")}`;
  assert.equal(
    toAnsi(art),
    `${ESC}[38;2;255;0;0m@${ESC}[38;2;0;0;255m#${ESC}[0m\n${ESC}[38;2;1;2;3m%${ESC}[0m`,
  );
});

test("toAnsi leaves uncolored art (halftone) alone and doesn't add resets", () => {
  assert.equal(toAnsi("█ █\n ██"), "█ █\n ██");
});

test("toAnsi decodes escaped characters and drops no text", () => {
  const ansi = toAnsi(cell("&lt;&amp;", "9,9,9"));
  assert.equal(ansi, `${ESC}[38;2;9;9;9m<&${ESC}[0m`);
});

test("toAnsi keeps blank cells between colored runs", () => {
  const ansi = toAnsi(`${cell("a", "1,1,1")}   ${cell("b", "2,2,2")}`);
  assert.equal(ansi, `${ESC}[38;2;1;1;1ma   ${ESC}[38;2;2;2;2mb${ESC}[0m`);
});
