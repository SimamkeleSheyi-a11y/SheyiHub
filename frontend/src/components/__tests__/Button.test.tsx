import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/Button";

describe("Button", () => {
  it("renders its label and responds to clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Schedule</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and unclickable while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} isLoading>
        Save
      </Button>
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
