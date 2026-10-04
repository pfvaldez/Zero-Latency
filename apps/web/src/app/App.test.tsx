import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";

describe("App (Phase 0 placeholder screen)", () => {
  it("shows the heading, the placeholder label and the core package marker", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Ask Noor" })).toBeInTheDocument();
    expect(screen.getByText(/PLACEHOLDER: Phase 0/)).toBeInTheDocument();
    expect(screen.getByText("@asknoor/core")).toBeInTheDocument();
  });

  it("renders the Animate UI tabs and opens the sheet from the button", async () => {
    render(<App />);
    expect(screen.getByRole("tab", { name: "Story" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Ask" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open sheet" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
