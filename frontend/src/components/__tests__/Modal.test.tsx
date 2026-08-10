import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "@/components/Modal";

describe("Modal", () => {
  it("does not render when closed", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Cancel meeting?">
        content
      </Modal>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders its title and content when open", () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Cancel meeting?">
        <p>This can't be undone.</p>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Cancel meeting?")).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Cancel meeting?">
        content
      </Modal>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Cancel meeting?">
        content
      </Modal>
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
