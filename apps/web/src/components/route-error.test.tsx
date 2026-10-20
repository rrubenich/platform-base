import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { m } from "@workspace/i18n/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteError } from "./route-error";

const invalidate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ invalidate }),
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

describe("RouteError", () => {
	beforeEach(() => invalidate.mockReset());

	it("explains the failure in the user's language, not the raw error", () => {
		render(<RouteError error={new Error("boom")} reset={vi.fn()} />);

		expect(screen.getByText(m.route_error_title())).toBeVisible();
		expect(screen.getByText(m.route_error_description())).toBeVisible();
		expect(screen.queryByText("boom")).toBeNull();
		expect(
			screen.getByRole("link", { name: m.route_error_home() }),
		).toHaveAttribute("href", "/");
	});

	it("retries by reloading the route", async () => {
		const reset = vi.fn();
		render(<RouteError error={new Error("boom")} reset={reset} />);

		await userEvent.click(
			screen.getByRole("button", { name: m.route_error_retry() }),
		);

		expect(reset).toHaveBeenCalled();
		expect(invalidate).toHaveBeenCalled();
	});
});
