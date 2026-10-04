import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

async function orderOne() {
  fireEvent.click(screen.getByRole("button", { name: "Quantity +" }));
  fireEvent.click(screen.getByRole("button", { name: "Quantity +" }));
  fireEvent.click(screen.getByRole("button", { name: "Order" }));
  expect(await screen.findByText("Show this to Noor")).toBeInTheDocument();
}
// Types the code and taps confirm; the form empties the field once the check has finished.
const enterCode = async (code: string) => {
  const field = screen.getByLabelText("Noor: enter your 4-digit farm code") as HTMLInputElement;
  fireEvent.change(field, { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Noor confirms your payment in person." }));
  await vi.waitFor(() => expect(field.value).toBe(""));
};

describe("Shop", () => {
  it("stores nothing when the guest orders; the order is stored only after Noor enters her farm code", async () => {
    const outbox = mount(<Shop lang="en" manifest={manifest} />);
    expect(screen.getByText("Your basket is empty.")).toBeInTheDocument();
    await orderOne();
    expect(screen.getByText(/2 × Synthetic fixture beans/)).toBeInTheDocument();
    expect(outbox.items).toEqual([]); // the guest alone cannot make a sale
    // The confirm button stays off until 4 digits are in, so a bare tap does nothing.
    expect(
      screen.getByRole("button", { name: "Noor confirms your payment in person." }),
    ).toBeDisabled();
    expect(outbox.items).toEqual([]);
    await enterCode("4827");
    expect(await screen.findByText("Noor confirmed your order.")).toBeInTheDocument();
    expect(outbox.items).toHaveLength(1);
    expect(outbox.items[0]).toMatchObject({ type: "order", confirmedByNoor: true });
  });

  it("a wrong code stores nothing and says so; three wrong codes lock the form for 30 seconds", async () => {
    const outbox = mount(<Shop lang="en" manifest={manifest} />);
    await orderOne();
    await enterCode("1111");
    expect(
      await screen.findByText("That code is not right. Nothing was saved."),
    ).toBeInTheDocument();
    await enterCode("2222");
    await enterCode("3333");
    expect(await screen.findByText(/Too many tries\. Wait \d+ seconds\./)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Noor confirms your payment in person." }),
    ).toBeDisabled();
    expect(outbox.items).toEqual([]);
  });

  it("labels the code as a prototype control", async () => {
    mount(<Shop lang="en" manifest={manifest} />);
    await orderOne();
    expect(screen.getByText(/Prototype control/)).toBeInTheDocument();
  });

  it("with a pack that has no farm code, the right digits still confirm nothing and the guest is told", async () => {
    const { farmCode: _removed, ...rest } = manifest;
    const outbox = mount(<Shop lang="en" manifest={rest} />);
    await orderOne();
    await enterCode("4827");
    expect(await screen.findByText(/cannot confirm orders yet/)).toBeInTheDocument();
    expect(outbox.items).toEqual([]);
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

  it("redacts an email and a phone number the guest typed, before anything is stored", async () => {
    const outbox = mount(<FeedbackForm lang="en" manifest={manifest} />);
    fireEvent.change(screen.getByLabelText(/What did you love/), {
      target: { value: "Great! write to me@example.com or call +220 123 4567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Thank you! Noor will hear about it.");
    const stored = JSON.stringify(outbox.items);
    expect(stored).not.toContain("me@example.com");
    expect(stored).not.toMatch(/123 4567/);
  });
});
