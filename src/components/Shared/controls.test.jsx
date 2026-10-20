import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button";
import IconButton from "./IconButton";
import Slider from "./Slider";
import Toggle from "./Toggle";

describe("Slider", () => {
  it("is named by its label", () => {
    render(<Slider label="Brightness" value={5} onChange={() => {}} />);
    expect(screen.getByLabelText("Brightness:")).toHaveValue("5");
  });

  it("shows no stray colon without a label, and is named by ariaLabel", () => {
    const { container } = render(
      <Slider
        ariaLabel="Width"
        value={120}
        onChange={() => {}}
        showValue={false}
      />,
    );

    expect(screen.getByRole("slider", { name: "Width" })).toBeInTheDocument();
    expect(container.querySelector("label")).toBeNull();
    expect(container).not.toHaveTextContent(":");
  });

  it("shows the value with its unit", () => {
    render(
      <Slider label="Contrast" unit="%" value={150} onChange={() => {}} />,
    );
    expect(screen.getByText("150%")).toBeInTheDocument();
  });

  it("reports numbers, not strings", () => {
    const onChange = vi.fn();
    render(
      <Slider label="Level" value={5} min={0} max={10} onChange={onChange} />,
    );

    fireEvent.change(screen.getByRole("slider"), { target: { value: "6" } });

    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("gives two sliders different ids so each label finds its own", () => {
    render(
      <>
        <Slider label="A" value={1} onChange={() => {}} />
        <Slider label="B" value={2} onChange={() => {}} />
      </>,
    );
    expect(screen.getByLabelText("A:")).toHaveValue("1");
    expect(screen.getByLabelText("B:")).toHaveValue("2");
  });
});

describe("Toggle", () => {
  it("can be focused and toggled from the keyboard", async () => {
    const onChange = vi.fn();
    render(<Toggle label="Invert" checked={false} onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByLabelText("Invert")).toHaveFocus();
    await userEvent.keyboard(" ");

    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Button", () => {
  it("shows its keyboard shortcut in the tooltip and to assistive tech", () => {
    render(
      <Button shortcut="Ctrl+S" title="Save">
        SAVE
      </Button>,
    );
    const button = screen.getByRole("button", { name: "SAVE" });

    expect(button).toHaveAttribute("title", "Save (Ctrl+S)");
    expect(button).toHaveAttribute("aria-keyshortcuts", "Ctrl+S");
  });

  it("has no tooltip without a title or shortcut", () => {
    render(<Button>PLAIN</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("title");
  });

  it("can be disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        NO
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("uses its title as its name and doesn't submit forms", () => {
    render(
      <IconButton title="Zoom In" onClick={() => {}}>
        +
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Zoom In" });
    expect(button).toHaveAttribute("type", "button");
  });
});
