import { describe, expect, it } from "vitest";
import { artSize } from "./artSize";

describe("artSize", () => {
  it("has no size without art", () => {
    expect(artSize("")).toBeNull();
    expect(artSize(null)).toBeNull();
  });

  it("counts plain characters and lines", () => {
    expect(artSize("abc\nde\n")).toEqual({ cols: 3, rows: 2 });
  });

  it("doesn't count the colour tags", () => {
    const line =
      '<span style="color:rgb(1,2,3)">ab</span><span style="color:rgb(4,5,6)">c</span>';
    expect(artSize(`${line}\n${line}`)).toEqual({ cols: 3, rows: 2 });
  });

  it("counts an escaped character once", () => {
    expect(artSize("a&lt;&amp;&gt;")).toEqual({ cols: 4, rows: 1 });
  });

  it("counts block characters once each", () => {
    expect(artSize("█▀▄")).toEqual({ cols: 3, rows: 1 });
  });
});
