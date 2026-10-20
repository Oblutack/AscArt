// Mirrors the rules in python/core/charsets.py so the field can complain while
// you type. The backend has the last word.

export const MIN_CUSTOM_CHARS = 2;
export const MAX_CUSTOM_CHARS = 100;

// Characters that take two cells (CJK, full-width forms) would break the grid
const WIDE_RANGES = [
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
];

/** @param {string} char */
const isWide = (char) => {
  const code = char.codePointAt(0) ?? 0;
  return (
    code > 0xffff ||
    WIDE_RANGES.some(([from, to]) => code >= from && code <= to)
  );
};

/**
 * Why this text can't be used as a character ramp, or null if it can.
 * @param {string} text
 * @returns {string | null}
 */
export function customCharsError(text) {
  const chars = [...text];

  for (const char of chars) {
    // Control/format characters and combining marks (a space is fine)
    if (/[\p{C}\p{M}]/u.test(char) || isWide(char)) {
      return `"${char}" can't be used: characters must be single-width and printable`;
    }
  }
  if (chars.length < MIN_CUSTOM_CHARS) {
    return `Enter at least ${MIN_CUSTOM_CHARS} characters`;
  }
  if (chars.length > MAX_CUSTOM_CHARS) {
    return `At most ${MAX_CUSTOM_CHARS} characters`;
  }
  return null;
}
