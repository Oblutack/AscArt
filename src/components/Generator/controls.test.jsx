import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ActionButtons from "./ActionButtons";
import AdjustmentPanel from "./AdjustmentPanel";
import InputPanel from "./InputPanel";
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

  it("offers exactly the character sets the backend has", () => {
    render(<WidthPanel {...props} />);
    const options = [...screen.getByLabelText("Style:").options].map(
      (o) => o.value,
    );
    expect(options).toEqual(["detailed", "blocks"]);
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

describe("ActionButtons", () => {
  const props = {
    onConvert: vi.fn(),
    onSave: vi.fn(),
    onWidget: vi.fn(),
    onHistory: vi.fn(),
    onQuit: vi.fn(),
    disabled: false,
    hasImage: true,
    isLoading: false,
  };
  const button = (name) => screen.getByRole("button", { name });

  it("can convert only with an image, and not while converting", () => {
    const { rerender } = render(<ActionButtons {...props} hasImage={false} />);
    expect(button(/CONVERT/)).toBeDisabled();

    rerender(<ActionButtons {...props} isLoading />);
    expect(button(/CONVERTING/)).toBeDisabled();

    rerender(<ActionButtons {...props} />);
    expect(button(/CONVERT/)).toBeEnabled();
  });

  it("can save and make a widget only when there is art", () => {
    render(<ActionButtons {...props} disabled />);
    expect(button(/SAVE/)).toBeDisabled();
    expect(button(/WIDGET/)).toBeDisabled();
  });

  it("history and quit are always available", () => {
    render(<ActionButtons {...props} disabled hasImage={false} />);
    expect(button(/HISTORY/)).toBeEnabled();
    expect(button(/QUIT/)).toBeEnabled();
  });

  it("calls the right handler", async () => {
    const handlers = {
      onConvert: vi.fn(),
      onSave: vi.fn(),
      onWidget: vi.fn(),
      onHistory: vi.fn(),
      onQuit: vi.fn(),
    };
    render(<ActionButtons {...props} {...handlers} />);

    await userEvent.click(button(/SAVE/));
    await userEvent.click(button(/HISTORY/));

    expect(handlers.onSave).toHaveBeenCalledTimes(1);
    expect(handlers.onHistory).toHaveBeenCalledTimes(1);
    expect(handlers.onConvert).not.toHaveBeenCalled();
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
    livePreview: true,
    setLivePreview: vi.fn(),
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

  it("only accepts images and GIFs in the file picker", () => {
    const { container } = render(<InputPanel {...props} />);
    expect(container.querySelector("#file-input")).toHaveAttribute(
      "accept",
      "image/*,.gif",
    );
  });

  it("has toggles for background removal and live preview", async () => {
    const setRemoveBackground = vi.fn();
    const setLivePreview = vi.fn();
    render(
      <InputPanel
        {...props}
        setRemoveBackground={setRemoveBackground}
        setLivePreview={setLivePreview}
      />,
    );

    await userEvent.click(screen.getByLabelText("Remove Background"));
    await userEvent.click(screen.getByLabelText("Live Preview"));

    expect(setRemoveBackground).toHaveBeenCalledWith(true);
    expect(setLivePreview).toHaveBeenCalledWith(false);
  });
});
