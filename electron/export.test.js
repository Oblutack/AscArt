const test = require("node:test");
const assert = require("node:assert/strict");
const { stripTags, buildHtml } = require("./export");

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
