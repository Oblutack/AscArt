import { beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAscart } from "../test/fakeAscart";
import { saveArt } from "./saveArt";

vi.mock("./renderArt", () => ({
  artToPng: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
  artToGif: vi.fn(async (frames, delays, onProgress) => {
    frames.forEach((_frame, i) => onProgress?.(i + 1, frames.length));
    return new Uint8Array([71, 73, 70]);
  }),
}));

const { artToGif, artToPng } = await import("./renderArt");

const still = { ascii: "<art>", isGif: false, frames: [], delays: [] };
const animated = {
  ascii: "f1",
  isGif: true,
  frames: ["f1", "f2", "f3"],
  delays: [10, 20, 30],
};

let fake;

beforeEach(() => {
  vi.clearAllMocks();
  fake = installFakeAscart();
});

const chooses = (filePath) =>
  fake.api.chooseSavePath.mockResolvedValue({ filePath });

describe("choosing", () => {
  it("offers GIF only for animated art", async () => {
    await saveArt(still);
    expect(fake.api.chooseSavePath).toHaveBeenLastCalledWith({ isGif: false });

    await saveArt(animated);
    expect(fake.api.chooseSavePath).toHaveBeenLastCalledWith({ isGif: true });
  });

  it("a GIF with a single frame counts as a still", async () => {
    await saveArt({ ...animated, frames: ["f1"], delays: [10] });
    expect(fake.api.chooseSavePath).toHaveBeenCalledWith({ isGif: false });
  });

  it("does nothing when the dialog is cancelled", async () => {
    fake.api.chooseSavePath.mockResolvedValue({ canceled: true });

    expect(await saveArt(still)).toEqual({ canceled: true });
    expect(fake.api.saveAscii).not.toHaveBeenCalled();
    expect(fake.api.saveBinary).not.toHaveBeenCalled();
  });
});

describe.each([".html", ".txt", ".ans", ".HTML"])(
  "text format %s",
  (extension) => {
    it("is built by the main process from the art", async () => {
      chooses(`C:/out/art${extension}`);

      const result = await saveArt(animated);

      expect(fake.api.saveAscii).toHaveBeenCalledWith(
        animated,
        `C:/out/art${extension}`,
      );
      expect(fake.api.saveBinary).not.toHaveBeenCalled();
      expect(result.filePath).toBe(`C:/out/art${extension}`);
    });
  },
);

describe("PNG", () => {
  it("draws the first frame and writes the bytes", async () => {
    chooses("C:/out/pic.png");

    const result = await saveArt(animated);

    expect(artToPng).toHaveBeenCalledWith("f1");
    expect(fake.api.saveBinary).toHaveBeenCalledWith(
      "C:/out/pic.png",
      new Uint8Array([137, 80, 78, 71]),
    );
    expect(fake.api.saveAscii).not.toHaveBeenCalled();
    expect(result.filePath).toBe("C:/out/pic.png");
  });
});

describe("GIF", () => {
  it("draws every frame with its delay and reports progress", async () => {
    chooses("C:/out/anim.gif");
    const onProgress = vi.fn();

    await saveArt(animated, { onProgress });

    expect(artToGif).toHaveBeenCalledWith(
      animated.frames,
      animated.delays,
      onProgress,
    );
    expect(onProgress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(fake.api.saveBinary).toHaveBeenCalledWith(
      "C:/out/anim.gif",
      new Uint8Array([71, 73, 70]),
    );
  });

  it("saving a still picture as .gif makes a one-frame GIF", async () => {
    chooses("C:/out/one.gif");

    await saveArt(still);

    expect(artToGif).toHaveBeenCalledWith(["<art>"], [], undefined);
  });
});

describe("failures", () => {
  it("drawing can fail", async () => {
    chooses("C:/out/pic.png");
    artToPng.mockRejectedValueOnce(new Error("canvas is gone"));

    expect(await saveArt(still)).toEqual({ error: "canvas is gone" });
    expect(fake.api.saveBinary).not.toHaveBeenCalled();
  });

  it("passes on what the main process says", async () => {
    chooses("C:/out/art.html");
    fake.api.saveAscii.mockResolvedValue({ error: "disk full" });

    expect(await saveArt(still)).toEqual({ error: "disk full" });
  });
});
