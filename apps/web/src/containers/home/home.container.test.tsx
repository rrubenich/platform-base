import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { HomeContainer } from "./home.container";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: vi.fn(),
		signOut: vi.fn(),
		updateUser: vi.fn(),
	},
}));

describe("HomeContainer", () => {
	beforeEach(() => {
		navigate.mockReset();
		vi.mocked(authClient.signOut)
			.mockReset()
			.mockResolvedValue({} as never);
		vi.mocked(authClient.useSession).mockReturnValue({
			data: {
				session: { id: "s1" },
				user: { id: "user-1", name: "Jane Doe", email: "jane@example.com" },
			},
		} as never);
	});

	it("welcomes the signed-in user by name", () => {
		render(<HomeContainer />);

		expect(
			screen.getByRole("heading", { name: "Welcome, Jane Doe" }),
		).toBeInTheDocument();
		expect(screen.getByText("JD")).toBeInTheDocument();
	});

	it("links to the security settings", () => {
		render(<HomeContainer />);

		expect(
			screen.getByRole("link", { name: "Security settings" }),
		).toHaveAttribute("href", "/settings/security");
	});

	it("signs out and goes to the sign-in page", async () => {
		render(<HomeContainer />);

		await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" }),
		);
		expect(authClient.signOut).toHaveBeenCalled();
	});
});
