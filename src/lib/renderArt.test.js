import { describe, expect, it } from "vitest";
import { columnsOf, fitFontSize, parseArt } from "./renderArt";

const span = (text, rgb = "1,2,3") =>
  `<span style="color:rgb(${rgb})">${text}</span>`;

describe("parseArt", () => {
  it("splits rows and runs, with their colors", () => {
    const rows = parseArt(
      `${span("@@", "255,0,0")}${span("#", "0,0,255")}\n${span("%")}`,
    );

    expect(rows).toEqual([
      [
        { text: "@@", color: "rgb(255,0,0)" },
        { text: "#", color: "rgb(0,0,255)" },
      ],
      [{ text: "%", color: "rgb(1,2,3)" }],
    ]);
  });

  it("keeps text outside spans (blank runs) without a color", () => {
    expect(parseArt(`${span("a")}   ${span("b")}`)[0]).toEqual([
      { text: "a", color: "rgb(1,2,3)" },
      { text: "   ", color: null },
      { text: "b", color: "rgb(1,2,3)" },
    ]);
  });

  it("reads uncolored art (halftone) as plain runs", () => {
    expect(parseArt("█ █\n ██")).toEqual([
      [{ text: "█ █", color: null }],
      [{ text: " ██", color: null }],
    ]);
  });

  it("decodes escaped characters", () => {
    expect(parseArt(span("&lt;&amp;&gt;"))[0][0].text).toBe("<&>");
    expect(parseArt("&amp;lt;")[0][0].text).toBe("&lt;");
  });

  it("an empty row has no runs", () => {
    expect(parseArt(`${span("a")}\n\n${span("b")}`)[1]).toEqual([]);
  });
});

describe("columnsOf", () => {
  it("is the width of the widest row", () => {
    const rows = parseArt(`${span("abc")}\n${span("a")}${span("bcde")}\n`);
    expect(columnsOf(rows)).toBe(5);
  });

  it("counts characters, not UTF-16 units", () => {
    expect(columnsOf(parseArt("█▓▒░"))).toBe(4);
  });

  it("is zero for nothing", () => {
    expect(columnsOf([])).toBe(0);
    expect(columnsOf(parseArt(""))).toBe(0);
  });
});

describe("fitFontSize", () => {
  it("uses the preferred size when the art is narrow enough", () => {
    expect(fitFontSize(50, 720, 10)).toBe(10);
  });

  it("shrinks so wide art fits the width", () => {
    // 300 columns * 0.6 * size <= 720  ->  size 4
    expect(fitFontSize(300, 720, 10)).toBe(4);
  });

  it("never goes below 2", () => {
    expect(fitFontSize(5000, 720, 10)).toBe(2);
  });

  it("copes with no columns", () => {
    expect(fitFontSize(0, 720, 10)).toBe(10);
  });
});
