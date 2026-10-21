import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdjustmentPanel from "./AdjustmentPanel";
import InputPanel from "./InputPanel";
import StatusBar from "./StatusBar";
import Toolbar from "./Toolbar";
import WidthPanel from "./WidthPanel";

describe("WidthPanel", () => {
  const props = {
    width: 120,
    setWidth: vi.fn(),
    ratio: "--",
    setRatio: vi.fn(),
    keepOriginal: false,
    setKeepOriginal: vi.fn(),
    charset: "detailed",
    setCharset: vi.fn(),
    colorScheme: "original",
    setColorScheme: vi.fn(),
  };

  it("labels each dropdown, so screen readers and getByLabelText find them", () => {
    render(<WidthPanel {...props} />);

    expect(screen.getByLabelText("Ratio:")).toHaveValue("--");
    expect(screen.getByLabelText("Style:")).toHaveValue("detailed");
    expect(screen.getByLabelText("Colors:")).toHaveValue("original");
  });

  it("offers the character sets the backend has, plus a custom one", () => {
    render(<WidthPanel {...props} />);
    const options = [...screen.getByLabelText("Style:").options].map(
      (o) => o.value,
    );
    expect(options).toEqual(["detailed", "blocks", "custom"]);
  });

  it("passes changes up", async () => {
    const setColorScheme = vi.fn();
    render(<WidthPanel {...props} setColorScheme={setColorScheme} />);

    await userEvent.selectOptions(screen.getByLabelText("Colors:"), "sepia");

    expect(setColorScheme).toHaveBeenCalledWith("sepia");
  });

  it("shows the width", () => {
    render(<WidthPanel {...props} width={187} />);
    expect(screen.getByText("187")).toBeInTheDocument();
  });
});

describe("Toolbar", () => {
  const props = {
    hasArt: true,
    onSave: vi.fn(),
    onCopy: vi.fn(),
    onWidget: vi.fn(),
    onHistory: vi.fn(),
  };
  const button = (name) => screen.getByRole("button", { name });

  it("can save, copy and make a widget only when there is art", () => {
    render(<Toolbar {...props} hasArt={false} />);
    expect(button("Save")).toBeDisabled();
    expect(button("Copy")).toBeDisabled();
    expect(button("Widget")).toBeDisabled();
  });

  it("history is always available", () => {
    render(<Toolbar {...props} hasArt={false} />);
    expect(button("History")).toBeEnabled();
  });

  it("calls the right handler", async () => {
    const handlers = {
      onSave: vi.fn(),
      onCopy: vi.fn(),
      onWidget: vi.fn(),
      onHistory: vi.fn(),
    };
    render(<Toolbar {...props} {...handlers} />);

    await userEvent.click(button("Save"));
    await userEvent.click(button("History"));

    expect(handlers.onSave).toHaveBeenCalledTimes(1);
    expect(handlers.onHistory).toHaveBeenCalledTimes(1);
    expect(handlers.onCopy).not.toHaveBeenCalled();
    expect(handlers.onWidget).not.toHaveBeenCalled();
  });

  it("says what is on screen", () => {
    render(<Toolbar {...props} summary="92 × 50 · 48 frames" />);
    expect(screen.getByText("92 × 50 · 48 frames")).toBeInTheDocument();
  });
});

describe("StatusBar", () => {
  it("says what the app is doing", () => {
    const { rerender } = render(<StatusBar state="ready" />);
    expect(screen.getByText("ready")).toBeInTheDocument();

    rerender(
      <StatusBar state="converting" progress={{ current: 3, total: 10 }} />,
    );
    expect(screen.getByText("converting 3/10")).toBeInTheDocument();

    rerender(<StatusBar state="camera" />);
    expect(screen.getByText("camera on")).toBeInTheDocument();
  });

  it("shows the settings it is given and the shortcuts", () => {
    render(<StatusBar state="live" details={["blocks", "sepia"]} />);
    expect(screen.getByText("blocks")).toBeInTheDocument();
    expect(screen.getByText("sepia")).toBeInTheDocument();
    expect(screen.getByText("history")).toBeInTheDocument();
  });
});

describe("AdjustmentPanel", () => {
  const props = {
    invert: false,
    setInvert: vi.fn(),
    dither: false,
    setDither: vi.fn(),
    brightness: 0,
    setBrightness: vi.fn(),
    contrast: 100,
    setContrast: vi.fn(),
    onReset: vi.fn(),
  };

  it("shows contrast as a percentage and brightness as a number", () => {
    render(<AdjustmentPanel {...props} brightness={-20} contrast={150} />);
    expect(screen.getByText("-20")).toBeInTheDocument();
    expect(screen.getByText("150%")).toBeInTheDocument();
  });

  it("toggles invert and dither", async () => {
    const setInvert = vi.fn();
    const setDither = vi.fn();
    render(
      <AdjustmentPanel
        {...props}
        setInvert={setInvert}
        setDither={setDither}
      />,
    );

    await userEvent.click(screen.getByLabelText("INVERT"));
    await userEvent.click(screen.getByLabelText("DITHER"));

    expect(setInvert).toHaveBeenCalledWith(true);
    expect(setDither).toHaveBeenCalledWith(true);
  });

  it("resets", async () => {
    const onReset = vi.fn();
    render(<AdjustmentPanel {...props} onReset={onReset} />);
    await userEvent.click(screen.getByRole("button", { name: /RESET/ }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe("InputPanel", () => {
  const props = {
    onLoadImage: vi.fn(),
    removeBackground: false,
    setRemoveBackground: vi.fn(),
    imagePreview: null,
  };

  it("shows the preview once there is one", () => {
    const { rerender } = render(<InputPanel {...props} />);
    expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();

    rerender(
      <InputPanel {...props} imagePreview="data:image/png;base64,AAAA" />,
    );
    expect(screen.getByAltText("Preview")).toHaveAttribute(
      "src",
      "data:image/png;base64,AAAA",
    );
  });

  it("hands a chosen file to the app", async () => {
    const onLoadImage = vi.fn();
    const { container } = render(
      <InputPanel {...props} onLoadImage={onLoadImage} />,
    );
    const file = new File(["x"], "cat.png", { type: "image/png" });

    await userEvent.upload(container.querySelector("#file-input"), file);

    expect(onLoadImage).toHaveBeenCalledWith(file);
  });

  it("accepts images, GIFs and videos in the file picker", () => {
    const { container } = render(<InputPanel {...props} />);
    expect(container.querySelector("#file-input")).toHaveAttribute(
      "accept",
      "image/*,.gif,video/*,.mkv,.avi",
    );
  });

  it("has a toggle for background removal", async () => {
    const setRemoveBackground = vi.fn();
    render(<InputPanel {...props} setRemoveBackground={setRemoveBackground} />);

    await userEvent.click(screen.getByLabelText("Remove Background"));

    expect(setRemoveBackground).toHaveBeenCalledWith(true);
  });
});

describe("WidthPanel custom characters", () => {
  const props = {
    width: 120,
    setWidth: vi.fn(),
    ratio: "--",
    setRatio: vi.fn(),
    keepOriginal: false,
    setKeepOriginal: vi.fn(),
    charset: "custom",
    setCharset: vi.fn(),
    customChars: "#.",
    setCustomChars: vi.fn(),
    customCharsError: null,
    colorScheme: "original",
    setColorScheme: vi.fn(),
  };

  it("has no field for the built-in sets", () => {
    render(<WidthPanel {...props} charset="blocks" />);
    expect(screen.queryByLabelText("Chars:")).not.toBeInTheDocument();
  });

  it("shows a field with the current characters and a hint", () => {
    render(<WidthPanel {...props} />);

    expect(screen.getByLabelText("Chars:")).toHaveValue("#.");
    expect(
      screen.getByText("Darkest first, lightest last"),
    ).toBeInTheDocument();
  });

  it("passes what is typed up", async () => {
    const setCustomChars = vi.fn();
    render(
      <WidthPanel {...props} customChars="" setCustomChars={setCustomChars} />,
    );

    await userEvent.type(screen.getByLabelText("Chars:"), "ab");

    expect(setCustomChars).toHaveBeenLastCalledWith("b");
    expect(setCustomChars).toHaveBeenCalledTimes(2);
  });

  it("shows the problem, marks the field invalid and announces it", () => {
    render(
      <WidthPanel {...props} customCharsError="Enter at least 2 characters" />,
    );

    expect(screen.getByLabelText("Chars:")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter at least 2 characters",
    );
    expect(
      screen.queryByText("Darkest first, lightest last"),
    ).not.toBeInTheDocument();
  });

  it("limits the length", () => {
    render(<WidthPanel {...props} />);
    expect(screen.getByLabelText("Chars:")).toHaveAttribute("maxLength", "100");
  });
});

describe("InputPanel with a video", () => {
  const props = {
    onLoadImage: vi.fn(),
    removeBackground: false,
    setRemoveBackground: vi.fn(),
    imagePreview: null,
  };

  it("shows its name instead of a picture", () => {
    render(<InputPanel {...props} isVideo imageName="holiday.mp4" />);

    expect(screen.getByText("holiday.mp4")).toBeInTheDocument();
    expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
  });

  it("shows a picture for images, not a name", () => {
    render(
      <InputPanel
        {...props}
        imagePreview="data:image/png;base64,AAAA"
        imageName="cat.png"
      />,
    );

    expect(screen.getByAltText("Preview")).toBeInTheDocument();
    expect(screen.queryByText("cat.png")).not.toBeInTheDocument();
  });
});

describe("InputPanel camera button", () => {
  const props = {
    onLoadImage: vi.fn(),
    removeBackground: false,
    setRemoveBackground: vi.fn(),
    imagePreview: null,
    onToggleCamera: vi.fn(),
  };

  it("starts the camera", async () => {
    const onToggleCamera = vi.fn();
    render(<InputPanel {...props} onToggleCamera={onToggleCamera} />);

    await userEvent.click(screen.getByRole("button", { name: "Camera" }));

    expect(onToggleCamera).toHaveBeenCalledTimes(1);
  });

  it("turns into a stop button and says the camera is on", () => {
    render(<InputPanel {...props} cameraActive />);

    expect(
      screen.getByRole("button", { name: "Stop camera" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Camera is on")).toBeInTheDocument();
    expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
  });

  it("can't be pressed twice while the camera is starting", () => {
    render(<InputPanel {...props} cameraStarting />);
    expect(screen.getByRole("button", { name: "Camera" })).toBeDisabled();
  });
});
