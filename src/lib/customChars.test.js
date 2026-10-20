import { describe, expect, it } from "vitest";
import { MAX_CUSTOM_CHARS, customCharsError } from "./customChars";

describe("customCharsError", () => {
  it.each(["#.", "@%#*+=-:. ", "█▓▒░ ", "ab", "o ", "·•"])(
    "accepts %j",
    (text) => {
      expect(customCharsError(text)).toBeNull();
    },
  );

  it("wants at least two characters", () => {
    expect(customCharsError("")).toMatch(/at least 2/);
    expect(customCharsError("x")).toMatch(/at least 2/);
  });

  it("allows up to a hundred and no more", () => {
    expect(customCharsError("a".repeat(MAX_CUSTOM_CHARS))).toBeNull();
    expect(customCharsError("a".repeat(MAX_CUSTOM_CHARS + 1))).toMatch(
      /At most/,
    );
  });

  it.each([
    ["a CJK character", "ab漢"],
    ["a full-width letter", "abＡ"],
    ["an emoji", "ab😀"],
    ["a newline", "ab\ncd"],
    ["a tab", "ab\tcd"],
    ["a control character", "ab\u0000"],
    ["a combining accent", "abé"],
  ])("refuses %s", (_name, text) => {
    expect(customCharsError(text)).toMatch(/single-width and printable/);
  });

  it("names the character that is the problem", () => {
    expect(customCharsError("ab漢")).toContain("漢");
  });

  it("counts characters, not UTF-16 units", () => {
    // two valid characters outside the Basic Multilingual Plane would be
    // refused as wide; a pair of ordinary ones must count as two
    expect(customCharsError("ab")).toBeNull();
    expect([..."ab"]).toHaveLength(2);
  });
});
