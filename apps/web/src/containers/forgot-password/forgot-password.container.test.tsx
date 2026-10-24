import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { authClient } from "@/lib/auth-client";
import { ForgotPasswordContainer } from "./forgot-password.container";

let search: { email?: string; redirect?: string } = {};

vi.mock("@tanstack/react-router", () => ({
	useSearch: () => search,
	Link: ({
		to,
		search: linkSearch,
		children,
	}: {
		to: string;
		search?: Record<string, string>;
		children: React.ReactNode;
	}) => (
		<a
			href={
				linkSearch && Object.keys(linkSearch).length > 0
					? `${to}?${new URLSearchParams(linkSearch)}`
					: to
			}
		>
			{children}
		</a>
	),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		requestPasswordReset: vi.fn(),
		updateUser: vi.fn(),
		useSession: () => ({ data: null }),
	},
}));

describe("ForgotPasswordContainer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		search = {};
	});

	it("emails a link that comes back to the reset page", async () => {
		vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
			data: { status: true },
			error: null,
		} as never);
		render(<ForgotPasswordContainer />);

		await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
		await userEvent.click(
			screen.getByRole("button", { name: "Send reset link" }),
		);

		expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
			email: "jane@example.com",
			redirectTo: `${window.location.origin}/reset-password`,
		});
		expect(await screen.findByRole("status")).toHaveTextContent(
			"If an account exists for jane@example.com",
		);
	});

	it("prefills the email and keeps the redirect on the way back to sign in", () => {
		search = { email: "jane@example.com", redirect: "/teams" };
		render(<ForgotPasswordContainer />);

		expect(screen.getByLabelText("Email")).toHaveValue("jane@example.com");
		expect(
			screen.getByRole("link", { name: "Back to sign in" }),
		).toHaveAttribute(
			"href",
			"/sign-in?email=jane%40example.com&redirect=%2Fteams",
		);
	});

	it("shows an error when the request fails, e.g. rate limiting", async () => {
		vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
			data: null,
			error: { status: 429 },
		} as never);
		render(<ForgotPasswordContainer />);

		await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
		await userEvent.click(
			screen.getByRole("button", { name: "Send reset link" }),
		);

		expect(await screen.findByText(/Too many/i)).toBeInTheDocument();
		expect(screen.queryByRole("status")).toBeNull();
	});
});
