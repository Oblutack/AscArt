import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OutputViewer from "./OutputViewer";

const still = {
  asciiArt: '<span style="color:rgb(1,2,3)">@@</span>',
  isLoading: false,
  progress: null,
  isGif: false,
  gifFrames: [],
  gifDelays: [],
  onStopProcessing: () => {},
};

const FRAMES = ["<i>one</i>", "<i>two</i>", "<i>three</i>"];
const gif = {
  ...still,
  asciiArt: FRAMES[0],
  isGif: true,
  gifFrames: FRAMES,
  gifDelays: [100, 100, 100],
};

const art = (container) => container.querySelector(".ascii-display");
const advance = (ms) => act(() => vi.advanceTimersByTime(ms));

describe("a still image", () => {
  it("shows a placeholder when there is nothing yet", () => {
    render(<OutputViewer {...still} asciiArt="" />);
    expect(screen.getByText("No output yet")).toBeInTheDocument();
  });

  it("shows the art, colors included", () => {
    const { container } = render(<OutputViewer {...still} />);
    expect(art(container).innerHTML).toBe(still.asciiArt);
  });

  it("has no GIF controls", () => {
    render(<OutputViewer {...still} />);
    expect(screen.queryByTitle("Pause")).not.toBeInTheDocument();
  });
});

describe("loading", () => {
  it("replaces the art with a spinner and offers Stop", () => {
    const onStop = vi.fn();
    const { container } = render(
      <OutputViewer {...still} isLoading onStopProcessing={onStop} />,
    );

    expect(screen.getByText("Generating ASCII art...")).toBeInTheDocument();
    expect(art(container)).toBeNull();

    fireEvent.click(screen.getByTitle("Stop Processing"));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("shows GIF progress", () => {
    render(
      <OutputViewer {...gif} isLoading progress={{ current: 4, total: 12 }} />,
    );
    expect(screen.getByText("Converting frame 4/12...")).toBeInTheDocument();
  });

  it("offers no Stop when nothing is running", () => {
    render(<OutputViewer {...still} />);
    expect(screen.queryByTitle("Stop Processing")).not.toBeInTheDocument();
  });
});

describe("zoom", () => {
  it("starts at 8px and steps by one", () => {
    const { container } = render(<OutputViewer {...still} />);
    expect(screen.getByText("8px")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Zoom In"));

    expect(screen.getByText("9px")).toBeInTheDocument();
    expect(art(container)).toHaveStyle({ fontSize: "9px", lineHeight: "9px" });
  });

  it("stays between 4 and 12", () => {
    render(<OutputViewer {...still} />);

    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByTitle("Zoom In"));
    expect(screen.getByText("12px")).toBeInTheDocument();

    for (let i = 0; i < 20; i++) fireEvent.click(screen.getByTitle("Zoom Out"));
    expect(screen.getByText("4px")).toBeInTheDocument();
  });

  it("the controls are real buttons, reachable and usable from the keyboard", async () => {
    const user = userEvent.setup();
    render(<OutputViewer {...still} />);

    const zoomOut = screen.getByRole("button", { name: "Zoom Out" });
    const zoomIn = screen.getByRole("button", { name: "Zoom In" });
    expect(zoomIn.tagName).toBe("BUTTON");

    await user.tab();
    expect(zoomOut).toHaveFocus();
    await user.tab();
    expect(zoomIn).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByText("9px")).toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.getByText("10px")).toBeInTheDocument();
  });

  it("the art is announced as an image", () => {
    render(<OutputViewer {...still} />);
    expect(screen.getByRole("img", { name: "ASCII art" })).toBeInTheDocument();
  });
});

describe("a GIF", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts playing from the first frame", () => {
    const { container } = render(<OutputViewer {...gif} />);

    expect(art(container).innerHTML).toBe(FRAMES[0]);
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByTitle("Pause")).toBeInTheDocument();
  });

  it("moves through the frames at their own pace and loops", () => {
    const { container } = render(<OutputViewer {...gif} />);

    advance(100);
    expect(art(container).innerHTML).toBe(FRAMES[1]);
    advance(100);
    expect(art(container).innerHTML).toBe(FRAMES[2]);
    advance(100);
    expect(art(container).innerHTML).toBe(FRAMES[0]);
  });

  it("uses each frame's own delay", () => {
    const { container } = render(
      <OutputViewer {...gif} gifDelays={[50, 500, 100]} />,
    );

    advance(49);
    expect(art(container).innerHTML).toBe(FRAMES[0]);
    advance(1);
    expect(art(container).innerHTML).toBe(FRAMES[1]);
    advance(499);
    expect(art(container).innerHTML).toBe(FRAMES[1]);
    advance(1);
    expect(art(container).innerHTML).toBe(FRAMES[2]);
  });

  it("pauses and resumes", () => {
    const { container } = render(<OutputViewer {...gif} />);

    fireEvent.click(screen.getByTitle("Pause"));
    advance(1000);
    expect(art(container).innerHTML).toBe(FRAMES[0]);

    fireEvent.click(screen.getByTitle("Play"));
    advance(100);
    expect(art(container).innerHTML).toBe(FRAMES[1]);
  });

  it("stop rewinds to the first frame", () => {
    const { container } = render(<OutputViewer {...gif} />);
    advance(100);
    advance(100); // one frame at a time: React schedules the next timer after each
    expect(art(container).innerHTML).toBe(FRAMES[2]);

    fireEvent.click(screen.getByTitle("Stop"));

    expect(art(container).innerHTML).toBe(FRAMES[0]);
    advance(1000);
    expect(art(container).innerHTML).toBe(FRAMES[0]);
  });

  it("plays faster or slower on request", () => {
    const { container } = render(<OutputViewer {...gif} />);

    fireEvent.change(screen.getByTitle("Playback Speed"), {
      target: { value: "2" },
    });
    advance(50); // 100ms frames at 2x
    expect(art(container).innerHTML).toBe(FRAMES[1]);

    fireEvent.change(screen.getByTitle("Playback Speed"), {
      target: { value: "0.5" },
    });
    advance(199);
    expect(art(container).innerHTML).toBe(FRAMES[1]);
    advance(1);
    expect(art(container).innerHTML).toBe(FRAMES[2]);
  });

  it("a newly loaded GIF starts over", () => {
    const { container, rerender } = render(<OutputViewer {...gif} />);
    advance(100);
    advance(100); // one frame at a time: React schedules the next timer after each
    expect(screen.getByText("3/3")).toBeInTheDocument();

    const next = ["<b>a</b>", "<b>b</b>"];
    rerender(
      <OutputViewer
        {...gif}
        asciiArt={next[0]}
        gifFrames={next}
        gifDelays={[100, 100]}
      />,
    );

    expect(art(container).innerHTML).toBe(next[0]);
    expect(screen.getByText("1/2")).toBeInTheDocument();
    advance(100);
    expect(art(container).innerHTML).toBe(next[1]);
  });

  it("a single frame has no playback controls", () => {
    render(
      <OutputViewer {...gif} gifFrames={["<i>only</i>"]} gifDelays={[100]} />,
    );
    expect(screen.queryByTitle("Pause")).not.toBeInTheDocument();
  });
});
