// End-to-end tests: the real Electron app, the real Python backend, the built UI.
const fs = require("fs");
const { spawnSync } = require("child_process");
const os = require("os");
const path = require("path");
const { test: base, expect, _electron: electron } = require("@playwright/test");

const ROOT = path.join(__dirname, "..");
const PHOTO = path.join(__dirname, "fixtures", "photo.png");
const ANIM = path.join(__dirname, "fixtures", "anim.gif");
const SLOW = path.join(__dirname, "fixtures", "slow.gif");
const CLIP = path.join(__dirname, "fixtures", "clip.mp4");

// Videos need ffmpeg on the machine
const hasFfmpeg =
  spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

/** Starts the app with its own data folder; pass userDataDir to reuse one. */
async function launch(userDataDir, extraEnv = {}) {
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userDataDir}`],
    cwd: ROOT,
    env: {
      ...process.env,
      ASCART_USE_BUILD: "1",
      ASCART_SKIP_LEGACY_IMPORT: "1",
      ...extraEnv,
    },
  });
  const page = await app.firstWindow();

  // Anything the page logs as an error (a CSP violation included) fails the test
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });

  await page.waitForSelector(".workspace");
  return { app, page, problems };
}

const test = base.extend({
  // Playwright insists on the destructuring pattern for "no dependencies"
  // eslint-disable-next-line no-empty-pattern
  userDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ascart-e2e-"));
    await use(dir);
    // Windows keeps some Chromium files locked for a moment after the app exits
    try {
      fs.rmSync(dir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 300,
      });
    } catch {
      /* a leftover temp folder is not a test failure */
    }
  },

  ascart: async ({ userDataDir }, use) => {
    const session = await launch(userDataDir);
    await use(session);
    expect(session.problems, "errors logged by the page").toEqual([]);
    await session.app.close();
  },
});

const art = (page) => page.locator(".ascii-display");

// Checkboxes, switches and the segmented choices are visually hidden inputs
// inside their labels, so click the label (which is what a person does)
const toggle = (page, label) =>
  page.locator("label", { hasText: new RegExp(`^${label}$`) }).click();
const choose = (page, name) =>
  page
    .locator("label", { has: page.getByRole("radio", { name, exact: true }) })
    .click();
const convert = (page) =>
  page.getByRole("button", { name: "Convert", exact: true });

/** The history list as the backend reports it */
const historyList = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const stop = window.ascart.onResponse((message) => {
          if (message.type === "history") {
            stop();
            resolve(message.history);
          }
        });
        window.ascart.getHistory();
      }),
  );

/** Collects everything the backend says, so tests can look at the sequence */
const recordMessages = (page) =>
  page.evaluate(() => {
    window.__messages = [];
    window.ascart.onResponse((message) => window.__messages.push(message));
  });
const messages = (page) => page.evaluate(() => window.__messages);

/** Makes the next Save As dialog "choose" this file */
const chooseSaveTarget = (app, filePath) =>
  app.evaluate(({ dialog }, target) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
  }, filePath);

test("starts without Node access in the page", async ({ ascart: { page } }) => {
  const exposed = await page.evaluate(() => ({
    require: typeof window.require,
    process: typeof window.process,
    api: Object.keys(window.ascart).sort(),
  }));

  expect(exposed.require).toBe("undefined");
  expect(exposed.process).toBe("undefined");
  expect(exposed.api).toContain("convert");
  expect(exposed.api).not.toContain("ipcRenderer");
});

test.describe("a picture", () => {
  test("is previewed on load, and CONVERT saves it to history", async ({
    ascart: { page },
  }) => {
    expect(await historyList(page)).toHaveLength(0);

    await page.locator("#file-input").setInputFiles(PHOTO);

    // Live preview: art appears by itself, without a spinner or a history entry
    await expect(art(page).locator("span").first()).toBeVisible();
    expect(await historyList(page)).toHaveLength(0);

    await convert(page).click();
    await expect.poll(async () => (await historyList(page)).length).toBe(1);

    const [entry] = await historyList(page);
    expect(entry.thumb).toContain("<span");
    expect(entry.ascii).toBeUndefined(); // the list only carries thumbnails
  });

  test("converts again when a setting changes", async ({
    ascart: { page },
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();
    const colorful = await art(page).innerHTML();

    await choose(page, "Grayscale");

    await expect.poll(() => art(page).innerHTML()).not.toBe(colorful);
    // grayscale means r = g = b in every color
    const colors = await art(page)
      .locator("span")
      .evaluateAll((spans) =>
        spans.slice(0, 50).map((span) => span.style.color),
      );
    for (const color of colors) {
      const [r, g, b] = color.match(/\d+/g).map(Number);
      expect(r === g && g === b).toBe(true);
    }
  });

  test("the Blocks style uses block characters", async ({
    ascart: { page },
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    await choose(page, "blocks");

    await expect
      .poll(async () => await art(page).textContent())
      .toMatch(/[█▓▒░]/);
    expect(await art(page).textContent()).not.toMatch(/@/);
  });

  test("a custom character set is used for the art", async ({
    ascart: { page },
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    await choose(page, "custom");
    await page.getByLabel("Your characters").fill("AB");

    await expect
      .poll(async () =>
        ((await art(page).textContent()) ?? "").replace(/\s/g, ""),
      )
      .toMatch(/^[AB]+$/);
    // a ramp that can't work is explained instead of sent
    await page.getByLabel("Your characters").fill("A");
    await expect(page.getByRole("alert")).toContainText("at least 2");
  });

  test("dither switches to a black and white halftone", async ({
    ascart: { page },
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    await toggle(page, "Halftone");

    await expect
      .poll(async () => (await art(page).textContent()) ?? "")
      .toMatch(/█/);
    expect(await art(page).locator("span").count()).toBe(0); // no colors in halftone
  });

  test("with live preview off nothing converts until Convert", async ({
    ascart: { page },
  }) => {
    await toggle(page, "Live preview");
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(page.getByAltText("Preview")).toBeVisible();

    await page.waitForTimeout(800);
    await expect(page.getByText("No output yet")).toBeVisible();

    await convert(page).click();
    await expect(art(page).locator("span").first()).toBeVisible();
  });
});

test.describe("saving", () => {
  test("as HTML keeps the colors, as text strips them", async ({
    ascart: { app, page },
    userDataDir,
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    const html = path.join(userDataDir, "art.html");
    await chooseSaveTarget(app, html);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toContainText(`Saved to ${html}`);
    const savedHtml = fs.readFileSync(html, "utf8");
    expect(savedHtml).toContain("<!DOCTYPE html>");
    expect(savedHtml).toContain('<span style="color:rgb(');

    const text = path.join(userDataDir, "art.txt");
    await chooseSaveTarget(app, text);
    await page.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => fs.existsSync(text)).toBe(true);
    const savedText = fs.readFileSync(text, "utf8");
    expect(savedText).not.toContain("<");
    expect(savedText.split("\n").length).toBeGreaterThan(5);
  });

  test("a cancelled dialog changes nothing", async ({
    ascart: { app, page },
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    await app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => ({ canceled: true });
    });
    await page.getByRole("button", { name: "Save" }).click();

    await page.waitForTimeout(500);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("a GIF saved as HTML plays on its own", async ({
    ascart: { app, page },
    userDataDir,
  }) => {
    await page.locator("#file-input").setInputFiles(ANIM);
    await convert(page).click();
    await expect(page.getByTitle("Pause")).toBeVisible();

    const html = path.join(userDataDir, "anim.html");
    await chooseSaveTarget(app, html);
    await page.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => fs.existsSync(html)).toBe(true);

    const saved = fs.readFileSync(html, "utf8");
    expect(saved).toContain("const frames = [");
    expect(saved).toContain("setTimeout");
  });
});

/**
 * Counts the pictures in a GIF by walking its blocks (a plain byte search
 * would also match inside compressed pixel data).
 */
function countGifFrames(bytes) {
  let position = 13; // header (6) + logical screen descriptor (7)
  const flags = bytes[10];
  if (flags & 0x80) position += 3 * 2 ** ((flags & 0x07) + 1); // global colors

  const skipSubBlocks = () => {
    while (bytes[position] !== 0) position += bytes[position] + 1;
    position += 1; // the zero-length terminator
  };

  let frames = 0;
  while (position < bytes.length && bytes[position] !== 0x3b) {
    if (bytes[position] === 0x21) {
      position += 2; // extension introducer + label
      skipSubBlocks();
    } else if (bytes[position] === 0x2c) {
      frames++;
      const imageFlags = bytes[position + 9];
      position += 10;
      if (imageFlags & 0x80) position += 3 * 2 ** ((imageFlags & 0x07) + 1);
      position += 1; // LZW minimum code size
      skipSubBlocks();
    } else {
      throw new Error(`Unexpected GIF block 0x${bytes[position].toString(16)}`);
    }
  }
  return frames;
}

const ESC = String.fromCharCode(27);

test.describe("more ways to save", () => {
  /** Width and height from a PNG's header */
  const pngSize = (bytes) => ({
    signature: bytes.subarray(0, 8).toString("hex"),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  });

  test("ANSI text has terminal color codes", async ({
    ascart: { app, page },
    userDataDir,
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    const target = path.join(userDataDir, "art.ans");
    await chooseSaveTarget(app, target);
    await page.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => fs.existsSync(target)).toBe(true);

    const text = fs.readFileSync(target, "utf8");
    expect(text).toMatch(new RegExp(`${ESC}\\[38;2;\\d+;\\d+;\\d+m`));
    expect(text).toContain(`${ESC}[0m`);
    expect(text).not.toContain("<span");
  });

  test("a PNG is a real picture of the art", async ({
    ascart: { app, page },
    userDataDir,
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    const target = path.join(userDataDir, "art.png");
    await chooseSaveTarget(app, target);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toContainText("Saved to");

    const bytes = fs.readFileSync(target);
    const { signature, width, height } = pngSize(bytes);
    expect(signature).toBe("89504e470d0a1a0a");
    expect(width).toBeGreaterThan(500);
    expect(height).toBeGreaterThan(200);

    // not an empty canvas: decode it in the page and look for colorful pixels
    const colorful = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const spread =
          Math.max(data[i], data[i + 1], data[i + 2]) -
          Math.min(data[i], data[i + 1], data[i + 2]);
        if (spread > 80) count++;
      }
      return count;
    }, bytes.toString("base64"));
    expect(colorful).toBeGreaterThan(200);
  });

  test("an animated GIF has every frame", async ({
    ascart: { app, page },
    userDataDir,
  }) => {
    await page.locator("#file-input").setInputFiles(ANIM);
    await convert(page).click();
    await expect(page.getByTitle("Pause")).toBeVisible();

    const target = path.join(userDataDir, "anim.gif");
    await chooseSaveTarget(app, target);
    await page.getByRole("button", { name: "Save" }).click();
    await expect
      .poll(() => fs.existsSync(target), { timeout: 30_000 })
      .toBe(true);
    await expect(page.getByRole("status")).toContainText("Saved to");

    const bytes = fs.readFileSync(target);
    expect(bytes.subarray(0, 6).toString("latin1")).toBe("GIF89a");

    expect(countGifFrames(bytes)).toBe(5);
  });

  test("COPY puts the plain characters on the clipboard", async ({
    ascart: { app, page },
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();
    const shown = await art(page).textContent();

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByRole("status")).toContainText("Copied");

    const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(copied).toBe(shown);
    expect(copied).not.toContain("<");
  });
});

test.describe("a GIF", () => {
  test("waits for CONVERT, then plays", async ({ ascart: { page } }) => {
    await page.locator("#file-input").setInputFiles(ANIM);
    await page.waitForTimeout(800);
    await expect(page.getByText("No output yet")).toBeVisible(); // too slow for live preview

    await convert(page).click();

    await expect(page.getByTitle("Pause")).toBeVisible();
    const first = await art(page).innerHTML();
    await expect.poll(() => art(page).innerHTML()).not.toBe(first); // it moves
  });

  test("Stop cancels the conversion and the backend stays usable", async ({
    ascart: { page },
  }) => {
    await recordMessages(page);
    await page.locator("#file-input").setInputFiles(SLOW);
    await convert(page).click();
    await expect(page.getByText(/Converting frame \d+\/100/)).toBeVisible();

    await page.getByTitle("Stop Processing").click();

    await expect(page.getByText("Conversion stopped")).toBeVisible();
    await expect(page.getByText(/Converting frame/)).toHaveCount(0);

    // the backend itself reports that it cancelled, and never delivers the result
    await expect
      .poll(async () =>
        (await messages(page)).some((m) => m.type === "cancelled"),
      )
      .toBe(true);
    await page.waitForTimeout(1500);
    const seen = await messages(page);
    expect(seen.some((m) => m.type === "gif-result")).toBe(false);
    const frames = seen
      .filter((m) => m.type === "progress")
      .map((m) => m.current);
    expect(Math.max(...frames)).toBeLessThan(100);

    // and it is still there: a normal conversion works right away
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();
  });
});

test.describe("history", () => {
  test("open an entry with the keyboard to restore its art and settings", async ({
    ascart: { page },
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await choose(page, "blocks");
    await choose(page, "Sepia");
    await expect
      .poll(async () => (await art(page).textContent()) ?? "")
      .toMatch(/[█▓▒░]/);
    await convert(page).click();
    await expect.poll(async () => (await historyList(page)).length).toBe(1);
    const converted = await art(page).innerHTML();

    // change everything, then bring the old result back from history
    await choose(page, "detailed");
    await choose(page, "Original");
    await page.getByRole("button", { name: "History" }).click();
    const tile = page.getByRole("button", { name: /characters wide/ });
    await tile.focus();
    await page.keyboard.press("Space");
    await expect(tile).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Load Selected" }).click();

    await expect(page.getByText("History / Gallery")).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "blocks" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Sepia" })).toBeChecked();
    expect(await art(page).innerHTML()).toBe(converted);
  });

  test("deleting removes the entry for good", async ({ ascart: { page } }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await convert(page).click();
    await expect.poll(async () => (await historyList(page)).length).toBe(1);

    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("button", { name: /characters wide/ }).click();
    await page.getByRole("button", { name: /Delete \(1\)/ }).click();

    await expect(page.getByText("No history yet")).toBeVisible();
    expect(await historyList(page)).toHaveLength(0);
  });
});

test.describe("widgets", () => {
  test("a picture opens in its own window with working controls", async ({
    ascart: { app, page },
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    const opened = app.waitForEvent("window");
    await page.getByRole("button", { name: "Widget" }).click();
    const widget = await opened;
    await widget.waitForSelector("#ascii-content span");

    expect(await widget.evaluate(() => typeof window.require)).toBe(
      "undefined",
    );
    await widget.locator('[data-action="larger"]').click();
    await expect(widget.locator("#size-info")).toHaveText("7px");

    await widget.getByRole("button", { name: "Close Widget" }).click();
    await expect.poll(() => app.windows().length).toBe(1);
  });

  test("a GIF widget animates and can be paused", async ({
    ascart: { app, page },
  }) => {
    await page.locator("#file-input").setInputFiles(ANIM);
    await convert(page).click();
    await expect(page.getByTitle("Pause")).toBeVisible();

    const opened = app.waitForEvent("window");
    await page.getByRole("button", { name: "Widget" }).click();
    const widget = await opened;
    await widget.waitForSelector("#ascii-content span");

    const frameLabel = widget.locator("#frame-info");
    const first = await frameLabel.textContent();
    await expect.poll(() => frameLabel.textContent()).not.toBe(first);

    await widget.locator("#btn-play").click(); // pause
    const paused = await frameLabel.textContent();
    await widget.waitForTimeout(500);
    expect(await frameLabel.textContent()).toBe(paused);
  });
});

test.describe("lockdown", () => {
  test("the page cannot navigate away or open windows", async ({
    ascart: { app, page },
  }) => {
    const before = page.url();

    await page.evaluate(() => {
      window.location.href = "https://example.com/";
    });
    const opened = await page.evaluate(() =>
      window.open("https://example.com/"),
    );
    await page.waitForTimeout(800);

    expect(page.url()).toBe(before);
    expect(opened).toBeNull();
    expect(app.windows()).toHaveLength(1);
    // Playwright still waits for the cancelled navigation to "finish", so ask
    // the page directly rather than through locators
    expect(
      await page.evaluate(() => document.querySelector(".workspace") !== null),
    ).toBe(true);
  });

  test("permission requests are refused", async ({ ascart: { page } }) => {
    const result = await page.evaluate(
      () =>
        new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve("granted"),
            (error) =>
              resolve(
                error.code === error.PERMISSION_DENIED
                  ? "denied"
                  : `error ${error.code}`,
              ),
          );
        }),
    );
    expect(result).toBe("denied");
  });
});

test.describe("a video", () => {
  test("is converted frame by frame and plays", async ({
    ascart: { page },
  }) => {
    test.skip(!hasFfmpeg, "ffmpeg is not installed");

    await page.locator("#file-input").setInputFiles(CLIP);
    // no picture to show: the name stands in, and nothing converts by itself
    await expect(
      page.getByRole("region", { name: "Source" }).getByText("clip.mp4"),
    ).toBeVisible();
    await expect(page.locator(".title-name")).toHaveText("clip.mp4");
    await expect(page.getByAltText("Preview")).toHaveCount(0);
    await page.waitForTimeout(800);
    await expect(page.getByText("No output yet")).toBeVisible();

    await convert(page).click();

    await expect(page.getByTitle("Pause")).toBeVisible();
    // 1 second at 10 frames per second (the counter keeps moving, so only the
    // total is checked)
    await expect(page.getByText(/^\d+\/10$/)).toBeVisible();
    const first = await art(page).innerHTML();
    await expect.poll(() => art(page).innerHTML()).not.toBe(first); // it moves
  });

  test("shows up in history as an animation", async ({ ascart: { page } }) => {
    test.skip(!hasFfmpeg, "ffmpeg is not installed");

    await page.locator("#file-input").setInputFiles(CLIP);
    await convert(page).click();
    await expect(page.getByTitle("Pause")).toBeVisible();

    await expect.poll(async () => (await historyList(page)).length).toBe(1);
    expect((await historyList(page))[0].isGif).toBe(true);
  });

  test("a dropped video is accepted", async ({ ascart: { page } }) => {
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(new File(["x"], "dropped.mkv", { type: "" }));
      window.dispatchEvent(
        new DragEvent("drop", { dataTransfer: data, cancelable: true }),
      );
    });

    // it is accepted (no "not an image" notice); a synthetic file has no path,
    // so nothing more can be checked here
    await page.waitForTimeout(500);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("without a working ffmpeg, the error says so", async ({
    userDataDir,
  }) => {
    const missing = path.join(userDataDir, "no-such-ffmpeg");
    const { app, page } = await launch(userDataDir, { ASCART_FFMPEG: missing });

    await page.locator("#file-input").setInputFiles(CLIP);
    await convert(page).click();

    await expect(page.getByRole("alert")).toContainText(
      "Could not start ffmpeg",
    );
    await app.close();
  });
});

test.describe("the camera", () => {
  // Chromium's fake camera (a moving test pattern) stands in for a webcam
  const launchWithCamera = (userDataDir) =>
    launch(userDataDir, { ASCART_FAKE_CAMERA: "1" });

  test("turns the webcam into live art and stops when asked", async ({
    userDataDir,
  }) => {
    const { app, page, problems } = await launchWithCamera(userDataDir);

    await page.getByRole("button", { name: "Camera", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Stop camera" }),
    ).toBeVisible();
    await expect(page.getByText("Camera is on")).toBeVisible();

    // art appears, and keeps changing because the picture does
    await expect(art(page).locator("span").first()).toBeVisible();
    const first = await art(page).innerHTML();
    await expect.poll(() => art(page).innerHTML()).not.toBe(first);

    // settings apply to the next frame
    await choose(page, "blocks");
    await expect
      .poll(async () => (await art(page).textContent()) ?? "")
      .toMatch(/[█▓▒░]/);

    // nothing goes to history
    expect(await historyList(page)).toHaveLength(0);

    await page.getByRole("button", { name: "Stop camera" }).click();
    await expect(
      page.getByRole("button", { name: "Camera", exact: true }),
    ).toBeVisible();
    const last = await art(page).innerHTML();
    await page.waitForTimeout(1000);
    expect(await art(page).innerHTML()).toBe(last); // frozen on the last picture

    expect(problems).toEqual([]);
    await app.close();
  });

  test("the camera is never used for audio", async ({ userDataDir }) => {
    const { app, page } = await launchWithCamera(userDataDir);

    const result = await page.evaluate(() =>
      navigator.mediaDevices.getUserMedia({ audio: true }).then(
        () => "granted",
        (error) => error.name,
      ),
    );

    expect(result).toBe("NotAllowedError");
    await app.close();
  });

  test("a widget window cannot use the camera", async ({ userDataDir }) => {
    const { app, page } = await launchWithCamera(userDataDir);
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    const opened = app.waitForEvent("window");
    await page.getByRole("button", { name: "Widget" }).click();
    const widget = await opened;
    await widget.waitForSelector("#ascii-content span");

    const result = await widget.evaluate(() =>
      navigator.mediaDevices.getUserMedia({ video: true }).then(
        () => "granted",
        (error) => error.name,
      ),
    );

    expect(result).toBe("NotAllowedError");
    await app.close();
  });
});

test.describe("the keyboard", () => {
  test("toggles can be reached and operated without a mouse", async ({
    ascart: { page },
  }) => {
    const invert = page
      .locator("label.toggle-container", { hasText: "Invert" })
      .locator("input");

    await invert.focus();
    await expect(invert).toBeFocused();
    await page.keyboard.press("Space");

    await expect(invert).toBeChecked();
    // and focus is visible: the custom checkmark next to it gets an outline
    const outline = await invert.evaluate(
      (input) => getComputedStyle(input.nextElementSibling).outlineStyle,
    );
    expect(outline).toBe("solid");
  });

  test("Ctrl+S saves, Ctrl+H opens the history and Escape closes it", async ({
    ascart: { app, page },
    userDataDir,
  }) => {
    await page.locator("#file-input").setInputFiles(PHOTO);
    await expect(art(page).locator("span").first()).toBeVisible();

    const target = path.join(userDataDir, "shortcut.html");
    await chooseSaveTarget(app, target);
    await page.keyboard.press("Control+s");
    await expect.poll(() => fs.existsSync(target)).toBe(true);

    await page.keyboard.press("Control+h");
    await expect(
      page.getByRole("dialog", { name: "History / Gallery" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Escape stops a running conversion", async ({ ascart: { page } }) => {
    await page.locator("#file-input").setInputFiles(SLOW);
    await expect(page.getByAltText("Preview")).toBeVisible(); // the file is read
    await page.keyboard.press("Control+Enter");
    await expect(page.getByText(/Converting frame \d+\/100/)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByText("Conversion stopped")).toBeVisible();
  });
});

test.describe("the window", () => {
  test("a dropped file that is not an image is refused", async ({
    ascart: { page },
  }) => {
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(new File(["hello"], "notes.txt", { type: "text/plain" }));
      window.dispatchEvent(
        new DragEvent("drop", { dataTransfer: data, cancelable: true }),
      );
    });

    await expect(page.getByRole("alert")).toContainText("not an image");
  });

  test("keeps its settings between runs", async ({ userDataDir }) => {
    const first = await launch(userDataDir);
    await choose(first.page, "Cyan");
    await toggle(first.page, "Live preview");
    await toggle(first.page, "Invert");
    await first.page.waitForTimeout(500); // saving is asynchronous
    expect(first.problems).toEqual([]);
    await first.app.close();

    const second = await launch(userDataDir);
    await expect(
      second.page.getByRole("radio", { name: "Cyan" }),
    ).toBeChecked();
    await expect(
      second.page.getByRole("switch", { name: "Live preview" }),
    ).not.toBeChecked();
    await expect(second.page.getByLabel("Invert")).toBeChecked();
    expect(second.problems).toEqual([]);
    await second.app.close();
  });

  test("quit leaves nothing running", async ({ userDataDir }) => {
    const { app, page } = await launch(userDataDir);
    const closed = new Promise((resolve) =>
      app.process().once("exit", resolve),
    );

    await page.evaluate(() => window.ascart.quit());

    await closed;
  });
});
