import { render, screen } from "@testing-library/react";
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

const openButtons = () => screen.getAllByRole("button", { name: /^Open / });
const deleteButtons = () => screen.getAllByRole("button", { name: /^Delete / });

describe("loading", () => {
  it("asks for the history and says it is loading meanwhile", () => {
    render(<GalleryView onClose={onClose} onLoadAscii={onLoadAscii} />);

    expect(fake.api.getHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loading history...")).toBeInTheDocument();
  });

  it("shows one entry per conversion with its thumbnail and settings", async () => {
    await renderGallery([
      entry(A),
      entry(B, {
        options: { width: 64, charset: "blocks", colorScheme: "sepia" },
      }),
      entry(C, { isGif: true }),
    ]);

    expect(openButtons()).toHaveLength(3);
    expect(screen.getByText("thumb-" + B)).toBeInTheDocument();
    expect(
      screen.getByText("64 characters wide · blocks · sepia"),
    ).toBeInTheDocument();
    expect(screen.getByText(/· animation$/)).toBeInTheDocument();
    expect(screen.getByText("3 kept, up to 50")).toBeInTheDocument();
  });

  it("says when there is no history", async () => {
    await renderGallery([]);
    expect(screen.getByText("No history yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear all…" }),
    ).not.toBeInTheDocument();
  });

  it("stops loading when the backend reports an error", async () => {
    render(<GalleryView onClose={onClose} onLoadAscii={onLoadAscii} />);
    await fake.emit({ status: "error", error: "history broke" });

    expect(screen.queryByText("Loading history...")).not.toBeInTheDocument();
  });
});

describe("opening an entry", () => {
  it("fetches the full entry, then hands it over and closes", async () => {
    await renderGallery();
    await userEvent.click(openButtons()[1]);

    expect(fake.api.getHistoryEntry).toHaveBeenCalledWith(B);
    for (const button of openButtons()) expect(button).toBeDisabled();
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

  it("can be opened from the keyboard", async () => {
    await renderGallery();
    openButtons()[0].focus();

    await userEvent.keyboard("{Enter}");

    expect(fake.api.getHistoryEntry).toHaveBeenCalledWith(A);
  });

  it("goes back to the art without loading anything", async () => {
    await renderGallery();

    await userEvent.click(
      screen.getByRole("button", { name: "Back to the art" }),
    );

    expect(onClose).toHaveBeenCalled();
    expect(onLoadAscii).not.toHaveBeenCalled();
  });
});

describe("deleting", () => {
  it("deletes one entry by id and removes it", async () => {
    await renderGallery();

    await userEvent.click(deleteButtons()[0]);

    expect(fake.api.deleteHistory).toHaveBeenCalledWith([A]);
    expect(openButtons()).toHaveLength(2);
    expect(screen.queryByText("thumb-" + A)).not.toBeInTheDocument();
  });

  it("clears everything, but only after asking", async () => {
    await renderGallery();

    await userEvent.click(screen.getByRole("button", { name: "Clear all…" }));
    expect(fake.api.deleteHistory).not.toHaveBeenCalled();
    expect(screen.getByText(/Delete all 3\?/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete all" }));

    expect(fake.api.deleteHistory).toHaveBeenCalledWith([A, B, C]);
    expect(screen.getByText("No history yet")).toBeInTheDocument();
  });

  it("can change its mind about clearing", async () => {
    await renderGallery();

    await userEvent.click(screen.getByRole("button", { name: "Clear all…" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep them" }));

    expect(fake.api.deleteHistory).not.toHaveBeenCalled();
    expect(openButtons()).toHaveLength(3);
  });
});

describe("as a dialog", () => {
  it("is announced as a modal dialog with a name", async () => {
    await renderGallery();
    expect(screen.getByRole("dialog", { name: "History" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
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
