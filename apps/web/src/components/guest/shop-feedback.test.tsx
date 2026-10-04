import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ServicesProvider } from "@/services/context.tsx";
import { fixtureManifest, MemoryOutbox, testServices } from "@/test/fakes.ts";
import { FeedbackForm } from "./FeedbackForm.tsx";
import { Shop } from "./Shop.tsx";

afterEach(cleanup);
const manifest = fixtureManifest();

const mount = (ui: React.ReactNode, outbox = new MemoryOutbox()) => {
  render(<ServicesProvider services={testServices({ outbox })}>{ui}</ServicesProvider>);
  return outbox;
};

describe("Shop", () => {
  it("stores nothing when the guest orders; the order is stored only when Noor confirms payment", async () => {
    const outbox = mount(<Shop lang="en" manifest={manifest} />);
    expect(screen.getByText("Your basket is empty.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quantity +" }));
    fireEvent.click(screen.getByRole("button", { name: "Quantity +" }));
    fireEvent.click(screen.getByRole("button", { name: "Order" }));
    expect(await screen.findByText("Show this to Noor")).toBeInTheDocument();
    expect(screen.getByText(/2 × Synthetic fixture beans/)).toBeInTheDocument();
    expect(outbox.items).toEqual([]); // the guest alone cannot make a sale
    fireEvent.click(screen.getByRole("button", { name: "Noor confirms your payment in person." }));
    expect(await screen.findByText("Noor confirmed your order.")).toBeInTheDocument();
    expect(outbox.items).toHaveLength(1);
    expect(outbox.items[0]).toMatchObject({ type: "order", confirmedByNoor: true });
  });

  it("disables Order until something is chosen, and labels the demo pack", () => {
    mount(<Shop lang="en" manifest={manifest} />);
    expect(screen.getByRole("button", { name: "Order" })).toBeDisabled();
    expect(screen.getByText("Demo mode")).toBeInTheDocument();
  });
});

describe("FeedbackForm", () => {
  it("sends loved and change to the outbox and thanks the guest", async () => {
    const outbox = mount(<FeedbackForm lang="en" manifest={manifest} />);
    fireEvent.change(screen.getByLabelText(/What did you love/), {
      target: { value: "The roasting demo" },
    });
    fireEvent.change(screen.getByLabelText(/What would you change/), {
      target: { value: "More shade" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Thank you! Noor will hear about it.")).toBeInTheDocument();
    expect(outbox.items[0]).toMatchObject({
      type: "feedback",
      loved: "The roasting demo",
      change: "More shade",
    });
  });

  it("asks for no name or contact, and stores nothing when both boxes are empty", () => {
    const outbox = mount(<FeedbackForm lang="en" manifest={manifest} />);
    expect(
      screen.getByText("Please do not write your name or contact details."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(outbox.items).toEqual([]);
  });
});
