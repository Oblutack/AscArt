import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAscart } from "../../test/fakeAscart";
import GalleryView from "./GalleryView";

const entry = (id, extra = {}) => ({
  id,
  timestamp: "2026-10-19T12:00:00",
  options: { width: 120, charset: "detailed" },
  isGif: false,
  thumb: `<span style="color:rgb(1,2,3)">thumb-${id}</span>`,
  ...extra,
});

const A = "a".repeat(32);
const B = "b".repeat(32);
const C = "c".repeat(32);

let fake;
let onClose;
let onLoadAscii;

beforeEach(() => {
  fake = installFakeAscart();
  onClose = vi.fn();
  onLoadAscii = vi.fn();
});

const renderGallery = async (entries = [entry(A), entry(B), entry(C)]) => {
  render(<GalleryView onClose={onClose} onLoadAscii={onLoadAscii} />);
  await fake.emit({ status: "success", type: "history", history: entries });
};

const tiles = () => screen.getAllByRole("button", { name: /characters wide/ });

describe("loading", () => {
  it("asks for the history and shows a spinner meanwhile", () => {
    render(<GalleryView onClose={onClose} onLoadAscii={onLoadAscii} />);

    expect(fake.api.getHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loading history...")).toBeInTheDocument();
  });

  it("shows one tile per entry with its thumbnail", async () => {
    await renderGallery();

    expect(tiles()).toHaveLength(3);
    expect(screen.getByText("thumb-" + B)).toBeInTheDocument();
  });

  it("says when there is no history", async () => {
    await renderGallery([]);
    expect(screen.getByText("No history yet")).toBeInTheDocument();
  });

  it("stops spinning when the backend reports an error", async () => {
    render(<GalleryView onClose={onClose} onLoadAscii={onLoadAscii} />);
    await fake.emit({ status: "error", error: "history broke" });

    expect(screen.queryByText("Loading history...")).not.toBeInTheDocument();
  });
});

describe("selecting", () => {
  it("selects one tile at a time on click", async () => {
    await renderGallery();

    await userEvent.click(tiles()[0]);
    await userEvent.click(tiles()[1]);

    expect(tiles()[0]).toHaveAttribute("aria-pressed", "false");
    expect(tiles()[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("adds to the selection with Ctrl+click", async () => {
    const user = userEvent.setup(); // one session, so the held key is remembered
    await renderGallery();

    await user.click(tiles()[0]);
    await user.keyboard("{Control>}");
    await user.click(tiles()[2]);
    await user.keyboard("{/Control}");

    expect(tiles()[0]).toHaveAttribute("aria-pressed", "true");
    expect(tiles()[2]).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Delete (2)" }),
    ).toBeInTheDocument();
  });

  it("can be operated from the keyboard", async () => {
    await renderGallery();

    await userEvent.tab(); // select all button comes first
    tiles()[0].focus();
    await userEvent.keyboard(" ");
    tiles()[2].focus();
    await userEvent.keyboard("{Enter}");

    expect(tiles()[0]).toHaveAttribute("aria-pressed", "true");
    expect(tiles()[1]).toHaveAttribute("aria-pressed", "false");
    expect(tiles()[2]).toHaveAttribute("aria-pressed", "true");

    tiles()[0].focus();
    await userEvent.keyboard(" "); // toggles off again
    expect(tiles()[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("selects and deselects everything", async () => {
    await renderGallery();

    await userEvent.click(screen.getByRole("button", { name: "Select All" }));
    expect(
      screen.getByRole("button", { name: "Delete (3)" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Deselect All" }));
    expect(
      screen.queryByRole("button", { name: /Delete/ }),
    ).not.toBeInTheDocument();
  });
});

describe("deleting", () => {
  it("deletes the selected entries by id and removes their tiles", async () => {
    const user = userEvent.setup();
    await renderGallery();
    await user.click(tiles()[0]);
    await user.keyboard("{Control>}");
    await user.click(tiles()[1]);
    await user.keyboard("{/Control}");

    await user.click(screen.getByRole("button", { name: "Delete (2)" }));

    expect(fake.api.deleteHistory).toHaveBeenCalledWith([A, B]);
    expect(tiles()).toHaveLength(1);
    expect(screen.getByText("thumb-" + C)).toBeInTheDocument();
  });
});

describe("opening an entry", () => {
  it("fetches the full entry, then hands it over and closes", async () => {
    await renderGallery();
    await userEvent.click(tiles()[1]);

    await userEvent.click(
      screen.getByRole("button", { name: "Load Selected" }),
    );
    expect(fake.api.getHistoryEntry).toHaveBeenCalledWith(B);
    expect(
      screen.getByRole("button", { name: "Load Selected" }),
    ).toBeDisabled();
    expect(onLoadAscii).not.toHaveBeenCalled();

    await fake.emit({
      status: "success",
      type: "history-entry",
      entry: entry(B, {
        ascii: "<full>",
        frames: ["f1"],
        delays: [9],
        isGif: true,
      }),
    });

    expect(onLoadAscii).toHaveBeenCalledWith(
      "<full>",
      { width: 120, charset: "detailed" },
      true,
      ["f1"],
      [9],
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("can't load several entries at once", async () => {
    await renderGallery();
    await userEvent.click(screen.getByRole("button", { name: "Select All" }));

    expect(
      screen.getByRole("button", { name: "Load Selected" }),
    ).toBeDisabled();
  });

  it("closes without loading from the close button", async () => {
    await renderGallery();
    const header = screen.getByText("History / Gallery").parentElement;

    await userEvent.click(within(header).getByRole("button", { name: "×" }));

    expect(onClose).toHaveBeenCalled();
    expect(onLoadAscii).not.toHaveBeenCalled();
  });
});

describe("as a dialog", () => {
  it("is announced as a modal dialog with a name", async () => {
    await renderGallery();
    expect(
      screen.getByRole("dialog", { name: "History / Gallery" }),
    ).toHaveAttribute("aria-modal", "true");
  });

  it("takes focus when it opens", async () => {
    await renderGallery();
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("closes on Escape, without anyone else seeing the key", async () => {
    await renderGallery();
    const elsewhere = vi.fn();
    window.addEventListener("keydown", elsewhere); // like the app's own shortcuts

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(elsewhere).not.toHaveBeenCalled();
    window.removeEventListener("keydown", elsewhere);
  });

  it("gives focus back to what had it before", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(
      <GalleryView onClose={onClose} onLoadAscii={onLoadAscii} />,
    );
    expect(opener).not.toHaveFocus();
    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });
});
