import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
	it("renders its children", () => {
		render(<Button>Click me</Button>);

		expect(
			screen.getByRole("button", { name: "Click me" }),
		).toBeInTheDocument();
	});

	it("calls onClick when clicked", async () => {
		const onClick = vi.fn();
		render(<Button onClick={onClick}>Click me</Button>);

		await userEvent.click(screen.getByRole("button", { name: "Click me" }));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("does not call onClick when disabled", async () => {
		const onClick = vi.fn();
		render(
			<Button disabled onClick={onClick}>
				Click me
			</Button>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Click me" }));

		expect(onClick).not.toHaveBeenCalled();
	});
});
