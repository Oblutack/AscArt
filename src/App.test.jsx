import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { installFakeAscart } from "./test/fakeAscart";
import { installFakeCamera } from "./test/fakeCamera";

const ART = '<span style="color:rgb(10,20,30)">@@@</span>';

let fake;

beforeEach(() => {
  fake = installFakeAscart();
});

const chooseImage = async (name = "cat.png") => {
  const file = new File(["x"], name, { type: "image/png" });
  await userEvent.upload(document.querySelector("#file-input"), file);
  await screen.findByAltText("Preview");
};

const convertButton = () => screen.getByRole("button", { name: /^Convert/ });
const output = () => document.querySelector(".ascii-display");

// The newest conversion the app asked for
const lastConvert = () => {
  const [id, path, options, saveHistory] = fake.api.convert.mock.calls.at(-1);
  return { id, path, options, saveHistory };
};

describe("start", () => {
  it("shows the panels and an empty output", async () => {
    render(<App />);

    expect(screen.getByText("No output yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Style:")).toBeInTheDocument();
    expect(convertButton()).toBeDisabled(); // no image yet
    await waitFor(() => expect(fake.api.loadSettings).toHaveBeenCalled());
  });

  it("applies saved settings", async () => {
    fake = installFakeAscart({
      loadSettings: () => Promise.resolve({ colorScheme: "sepia", width: 150 }),
    });
    render(<App />);

    await waitFor(() =>
      expect(screen.getByLabelText("Colors:")).toHaveValue("sepia"),
    );
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("saves a setting when it changes", async () => {
    render(<App />);
    await waitFor(() => expect(fake.api.saveSettings).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText("Colors:"), "cyan");

    expect(fake.api.saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ colorScheme: "cyan" }),
    );
  });
});

describe("converting", () => {
  it("previews a loaded image automatically, without touching history", async () => {
    render(<App />);
    await chooseImage("cat.png");

    await waitFor(() => expect(fake.api.convert).toHaveBeenCalled());
    const { path, saveHistory, options } = lastConvert();
    expect(path).toBe("C:/images/cat.png");
    expect(saveHistory).toBe(false);
    expect(options).toMatchObject({ width: 120, charset: "detailed" });
    // a preview keeps the screen as it is: no spinner
    expect(
      screen.queryByText("Generating ASCII art..."),
    ).not.toBeInTheDocument();

    fake.emit({
      type: "ascii-result",
      ascii: ART,
      requestId: lastConvert().id,
    });
    await waitFor(() => expect(output().innerHTML).toBe(ART));
  });

  it("Convert shows a spinner, keeps the result in history and enables saving", async () => {
    render(<App />);
    await chooseImage();
    await userEvent.click(screen.getByLabelText("Live Preview")); // switch live preview off
    fake.api.convert.mockClear();

    await userEvent.click(convertButton());

    expect(lastConvert().saveHistory).toBe(true);
    expect(screen.getByText("Generating ASCII art...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Converting/ })).toBeDisabled();

    await fake.emit({
      type: "ascii-result",
      ascii: ART,
      requestId: lastConvert().id,
    });

    expect(output().innerHTML).toBe(ART);
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("changing a setting converts again", async () => {
    render(<App />);
    await chooseImage();
    await waitFor(() => expect(fake.api.convert).toHaveBeenCalledTimes(1));

    await userEvent.selectOptions(screen.getByLabelText("Style:"), "blocks");

    await waitFor(() => expect(fake.api.convert).toHaveBeenCalledTimes(2));
    expect(lastConvert().options.charset).toBe("blocks");
  });

  it("with live preview off, nothing happens until Convert", async () => {
    render(<App />);
    await userEvent.click(screen.getByLabelText("Live Preview"));
    await chooseImage();

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fake.api.convert).not.toHaveBeenCalled();
  });

  it("a GIF waits for Convert, shows progress, then plays", async () => {
    render(<App />);
    await chooseImage("anim.gif");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fake.api.convert).not.toHaveBeenCalled(); // too slow for live preview

    await userEvent.click(convertButton());
    const { id } = lastConvert();
    await fake.emit({ type: "progress", current: 2, total: 5, requestId: id });
    expect(screen.getByText("Converting frame 2/5...")).toBeInTheDocument();

    await fake.emit({
      type: "gif-result",
      frames: [ART, "<i>b</i>"],
      delays: [100, 100],
      requestId: id,
    });

    expect(output().innerHTML).toBe(ART);
    expect(screen.getByTitle("Pause")).toBeInTheDocument();
  });

  it("shows backend errors as a notice you can dismiss", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    await chooseImage();
    await userEvent.click(screen.getByLabelText("Live Preview"));
    await userEvent.click(convertButton());

    await fake.emit({
      status: "error",
      error: "Conversion failed: boom",
      requestId: lastConvert().id,
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Conversion failed: boom");
    expect(convertButton()).toBeEnabled();

    await userEvent.click(
      within(alert).getByRole("button", { name: "Dismiss" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Stop cancels the request that is running", async () => {
    render(<App />);
    await chooseImage("anim.gif");
    await userEvent.click(convertButton());
    const { id } = lastConvert();

    await userEvent.click(screen.getByTitle("Stop Processing"));

    expect(fake.api.stop).toHaveBeenCalledWith(id);
    expect(
      screen.queryByText("Generating ASCII art..."),
    ).not.toBeInTheDocument();

    // the answer that was already on its way is thrown away
    await fake.emit({
      type: "gif-result",
      frames: [ART],
      delays: [1],
      requestId: id,
    });
    expect(screen.getByText("No output yet")).toBeInTheDocument();
  });
});

describe("with art on screen", () => {
  const showArt = async () => {
    render(<App />);
    await chooseImage();
    await waitFor(() => expect(fake.api.convert).toHaveBeenCalled());
    await fake.emit({
      type: "ascii-result",
      ascii: ART,
      requestId: lastConvert().id,
    });
  };

  it("saves it and says where", async () => {
    await showArt();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(fake.api.chooseSavePath).toHaveBeenCalledWith({ isGif: false });
    expect(fake.api.saveAscii).toHaveBeenCalledWith(
      { ascii: ART, isGif: false, frames: [], delays: [] },
      "C:/out/art.html",
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Saved to C:/out/art.html",
    );
  });

  it("says nothing when the save dialog is cancelled", async () => {
    fake.api.chooseSavePath.mockResolvedValue({ canceled: true });
    await showArt();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fake.api.chooseSavePath).toHaveBeenCalled());
    expect(fake.api.saveAscii).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a failed save", async () => {
    fake.api.saveAscii.mockResolvedValue({ error: "disk full" });
    await showArt();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Save failed: disk full",
    );
  });

  it("copies the text to the clipboard", async () => {
    await showArt();

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(fake.api.copyText).toHaveBeenCalledWith({
      ascii: ART,
      isGif: false,
      frames: [],
      delays: [],
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Copied");
  });

  it("reports a failed copy", async () => {
    fake.api.copyText.mockResolvedValue({ error: "no clipboard" });
    await showArt();

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Copy failed: no clipboard",
    );
  });

  it("has nothing to copy or save before there is art", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("opens it as a widget", async () => {
    await showArt();

    await userEvent.click(screen.getByRole("button", { name: "Widget" }));

    expect(fake.api.openWidget).toHaveBeenCalledWith({
      isGif: false,
      ascii: ART,
      frames: [],
      delays: [],
    });
  });
});

describe("history", () => {
  it("loads an entry: shows its art, restores its settings, forgets the loaded image", async () => {
    render(<App />);
    await chooseImage();
    await waitFor(() => expect(fake.api.convert).toHaveBeenCalled());
    fake.api.convert.mockClear();

    await userEvent.click(screen.getByRole("button", { name: "History" }));
    const id = "d".repeat(32);
    await fake.emit({
      type: "history",
      history: [
        {
          id,
          timestamp: "2026-10-19T12:00:00",
          options: { width: 80, charset: "blocks", colorScheme: "sepia" },
          isGif: false,
          thumb: "t",
        },
      ],
    });

    await userEvent.click(
      screen.getByRole("button", { name: /characters wide/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Load Selected" }),
    );
    expect(fake.api.getHistoryEntry).toHaveBeenCalledWith(id);

    await fake.emit({
      type: "history-entry",
      entry: {
        id,
        options: { width: 80, charset: "blocks", colorScheme: "sepia" },
        isGif: false,
        ascii: ART,
      },
    });

    expect(output().innerHTML).toBe(ART);
    expect(screen.getByLabelText("Style:")).toHaveValue("blocks");
    expect(screen.getByLabelText("Colors:")).toHaveValue("sepia");
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();

    // and live preview must not now overwrite the loaded art with the old image
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fake.api.convert).not.toHaveBeenCalled();
    expect(screen.queryByText("History / Gallery")).not.toBeInTheDocument();
  });
});

describe("window", () => {
  it("closes and minimizes", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Minimize" }));

    expect(fake.api.quit).toHaveBeenCalledTimes(1);
    expect(fake.api.minimize).toHaveBeenCalledTimes(1);
  });
});

describe("keyboard shortcuts", () => {
  const showArt = async () => {
    render(<App />);
    await chooseImage();
    await waitFor(() => expect(fake.api.convert).toHaveBeenCalled());
    await fake.emit({
      type: "ascii-result",
      ascii: ART,
      requestId: lastConvert().id,
    });
  };

  it("Ctrl+S saves", async () => {
    await showArt();
    await userEvent.keyboard("{Control>}s{/Control}");
    await waitFor(() => expect(fake.api.saveAscii).toHaveBeenCalled());
    expect(fake.api.chooseSavePath).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Enter converts and saves to history", async () => {
    await showArt();
    await userEvent.click(screen.getByLabelText("Live Preview"));
    fake.api.convert.mockClear();

    await userEvent.keyboard("{Control>}{Enter}{/Control}");

    expect(lastConvert().saveHistory).toBe(true);
  });

  it("Ctrl+Enter does nothing without an image", async () => {
    render(<App />);
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(fake.api.convert).not.toHaveBeenCalled();
  });

  it("Ctrl+H opens the history and Escape closes it again", async () => {
    render(<App />);

    await userEvent.keyboard("{Control>}h{/Control}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(fake.api.getHistory).toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape stops a running conversion, but not while the history is open", async () => {
    render(<App />);
    await chooseImage("anim.gif");
    await userEvent.click(convertButton());
    const { id } = lastConvert();

    await userEvent.keyboard("{Control>}h{/Control}");
    await userEvent.keyboard("{Escape}"); // closes the history only
    expect(fake.api.stop).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}"); // now it stops
    expect(fake.api.stop).toHaveBeenCalledWith(id);
  });

  it("Ctrl+O opens the file picker", async () => {
    render(<App />);
    const click = vi.spyOn(document.querySelector("#file-input"), "click");

    await userEvent.keyboard("{Control>}o{/Control}");

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("the buttons tell you their shortcuts", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /^Convert/ })).toHaveAttribute(
      "title",
      "Convert and keep it in history (Ctrl+Enter)",
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Ctrl+S",
    );
    expect(screen.getByRole("button", { name: "History" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Ctrl+H",
    );
    expect(screen.getByRole("button", { name: "Open…" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Ctrl+O",
    );
  });
});

describe("custom characters", () => {
  const chooseCustom = async () => {
    await userEvent.selectOptions(screen.getByLabelText("Style:"), "custom");
    const field = screen.getByLabelText("Chars:");
    await userEvent.clear(field);
    return field;
  };

  it("sends the typed ramp to the backend", async () => {
    render(<App />);
    await chooseImage();
    await waitFor(() => expect(fake.api.convert).toHaveBeenCalled());
    fake.api.convert.mockClear();

    const field = await chooseCustom();
    await userEvent.type(field, "AB");

    await waitFor(() =>
      expect(lastConvert().options).toMatchObject({
        charset: "custom",
        customChars: "AB",
      }),
    );
  });

  it("doesn't send a half-typed ramp, and says what is wrong", async () => {
    render(<App />);
    await chooseImage();
    await waitFor(() => expect(fake.api.convert).toHaveBeenCalled());
    await userEvent.click(screen.getByLabelText("Live Preview")); // off
    fake.api.convert.mockClear();
    await userEvent.click(screen.getByLabelText("Live Preview")); // on again

    const field = await chooseCustom();
    await userEvent.type(field, "A");

    expect(screen.getByRole("alert")).toHaveTextContent("at least 2");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(
      fake.api.convert.mock.calls.some(
        ([, , options]) => options.customChars === "A",
      ),
    ).toBe(false);
  });

  it("Convert with an invalid ramp shows the problem instead of converting", async () => {
    render(<App />);
    await chooseImage();
    await userEvent.click(screen.getByLabelText("Live Preview"));
    await chooseCustom();
    fake.api.convert.mockClear();

    await userEvent.click(convertButton());

    expect(fake.api.convert).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("at least 2");
  });
});

describe("camera", () => {
  let camera;

  beforeEach(() => {
    camera = installFakeCamera();
  });

  const cameraButton = () => screen.getByRole("button", { name: "Camera" });
  const frameCount = () => fake.api.convertFrame.mock.calls.length;

  it("turns the webcam into live art", async () => {
    render(<App />);

    await userEvent.click(cameraButton());

    expect(
      await screen.findByRole("button", { name: "Stop camera" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(fake.api.convertFrame).toHaveBeenCalled());
    const [id, imageData, options] = fake.api.convertFrame.mock.calls[0];
    expect(imageData).toBe("QUJD");
    expect(options).toMatchObject({ width: 120, charset: "detailed" });

    await fake.emit({ type: "ascii-result", ascii: ART, requestId: id });
    expect(output().innerHTML).toBe(ART);
    expect(fake.api.convert).not.toHaveBeenCalled(); // not through the file path
  });

  it("uses the settings as they change", async () => {
    render(<App />);
    await userEvent.click(cameraButton());
    await waitFor(() => expect(fake.api.convertFrame).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText("Style:"), "blocks");
    // answer the frame that was in flight so the next one can go out
    await fake.emit({
      type: "ascii-result",
      ascii: ART,
      requestId: fake.api.convertFrame.mock.calls.at(-1)[0],
    });

    await waitFor(() =>
      expect(fake.api.convertFrame.mock.calls.at(-1)[2].charset).toBe("blocks"),
    );
  });

  it("Stop camera releases the camera and stops sending", async () => {
    render(<App />);
    await userEvent.click(cameraButton());
    await waitFor(() => expect(fake.api.convertFrame).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: "Stop camera" }));

    expect(camera.track.stop).toHaveBeenCalled();
    const sent = frameCount();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(frameCount()).toBe(sent);
    expect(screen.getByRole("button", { name: "Camera" })).toBeInTheDocument();
  });

  it("Escape turns the camera off", async () => {
    render(<App />);
    await userEvent.click(cameraButton());
    await screen.findByRole("button", { name: "Stop camera" });

    await userEvent.keyboard("{Escape}");

    expect(camera.track.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Camera" })).toBeInTheDocument();
  });

  it("picking a picture takes over from the camera", async () => {
    render(<App />);
    await userEvent.click(cameraButton());
    await screen.findByRole("button", { name: "Stop camera" });

    await chooseImage();

    expect(camera.track.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Camera" })).toBeInTheDocument();
  });

  it("live preview of a loaded picture waits while the camera is on", async () => {
    render(<App />);
    await chooseImage();
    await waitFor(() => expect(fake.api.convert).toHaveBeenCalled());
    fake.api.convert.mockClear();

    await userEvent.click(cameraButton());
    await userEvent.selectOptions(screen.getByLabelText("Style:"), "blocks");
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fake.api.convert).not.toHaveBeenCalled();
  });

  it("explains when the camera is refused", async () => {
    camera.getUserMedia.mockRejectedValue(
      Object.assign(new Error("no"), { name: "NotAllowedError" }),
    );
    render(<App />);

    await userEvent.click(cameraButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Camera access was refused",
    );
    expect(screen.getByRole("button", { name: "Camera" })).toBeEnabled();
  });

  it("doesn't send a half-typed character set", async () => {
    render(<App />);
    await userEvent.selectOptions(screen.getByLabelText("Style:"), "custom");
    await userEvent.clear(screen.getByLabelText("Chars:"));

    await userEvent.click(cameraButton());
    await screen.findByRole("button", { name: "Stop camera" });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(fake.api.convertFrame).not.toHaveBeenCalled();
  });
});
