import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Toast from "./Toast";

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("renders nothing without a toast", () => {
    const { container } = render(<Toast toast={null} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces errors as alerts and notices as status", () => {
    const { rerender } = render(
      <Toast
        toast={{ id: 1, kind: "error", message: "Boom" }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");

    rerender(
      <Toast
        toast={{ id: 2, kind: "info", message: "Saved" }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("can be dismissed with its button", async () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        toast={{ id: 1, kind: "info", message: "Saved" }}
        onDismiss={onDismiss}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("goes away by itself, errors after a longer wait", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <Toast
        toast={{ id: 1, kind: "info", message: "x" }}
        onDismiss={onDismiss}
      />,
    );

    act(() => vi.advanceTimersByTime(4000));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(
      <Toast
        toast={{ id: 2, kind: "error", message: "y" }}
        onDismiss={onDismiss}
      />,
    );
    act(() => vi.advanceTimersByTime(4000));
    expect(onDismiss).toHaveBeenCalledTimes(1); // still showing
    act(() => vi.advanceTimersByTime(4000));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("a new toast restarts the timer", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <Toast
        toast={{ id: 1, kind: "info", message: "a" }}
        onDismiss={onDismiss}
      />,
    );

    act(() => vi.advanceTimersByTime(3000));
    rerender(
      <Toast
        toast={{ id: 2, kind: "info", message: "b" }}
        onDismiss={onDismiss}
      />,
    );
    act(() => vi.advanceTimersByTime(3000));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
