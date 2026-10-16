import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { LoginContainer } from "./login.container";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: {
			email: vi.fn(),
			magicLink: vi.fn(),
			social: vi.fn(),
		},
	},
}));

describe("LoginContainer", () => {
	beforeEach(() => {
		navigate.mockReset();
		vi.mocked(authClient.signIn.email).mockReset();
		vi.mocked(authClient.signIn.magicLink).mockReset();
		vi.mocked(authClient.signIn.social).mockReset();
	});

	describe("email & password", () => {
		it("signs in and navigates home on success", async () => {
			vi.mocked(authClient.signIn.email).mockResolvedValue({
				data: {},
				error: null,
			} as never);

			render(<LoginContainer />);

			await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
			await userEvent.type(screen.getByLabelText("Password"), "s3cret-pass");
			await userEvent.click(screen.getByRole("button", { name: "Login" }));

			expect(authClient.signIn.email).toHaveBeenCalledWith({
				email: "jane@example.com",
				password: "s3cret-pass",
				callbackURL: "/",
			});
			expect(navigate).toHaveBeenCalledWith({ to: "/" });
		});

		it("shows an error and does not navigate on failure", async () => {
			vi.mocked(authClient.signIn.email).mockResolvedValue({
				data: null,
				error: { message: "Invalid email or password" },
			} as never);

			render(<LoginContainer />);

			await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
			await userEvent.type(screen.getByLabelText("Password"), "wrong-pass");
			await userEvent.click(screen.getByRole("button", { name: "Login" }));

			expect(
				await screen.findByText("Invalid email or password"),
			).toBeInTheDocument();
			expect(navigate).not.toHaveBeenCalled();
		});
	});

	describe("magic link", () => {
		it("switches mode, sends the link, and shows confirmation", async () => {
			vi.mocked(authClient.signIn.magicLink).mockResolvedValue({
				data: {},
				error: null,
			} as never);

			render(<LoginContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: "Email me a sign-in link" }),
			);

			expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();

			await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
			await userEvent.click(
				screen.getByRole("button", { name: "Send magic link" }),
			);

			expect(authClient.signIn.magicLink).toHaveBeenCalledWith({
				email: "jane@example.com",
				callbackURL: "/",
			});
			expect(
				await screen.findByText("Check your email for a sign-in link."),
			).toBeInTheDocument();
			expect(navigate).not.toHaveBeenCalled();
		});

		it("shows an error when sending the link fails", async () => {
			vi.mocked(authClient.signIn.magicLink).mockResolvedValue({
				data: null,
				error: { message: "Too many requests" },
			} as never);

			render(<LoginContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: "Email me a sign-in link" }),
			);
			await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
			await userEvent.click(
				screen.getByRole("button", { name: "Send magic link" }),
			);

			expect(await screen.findByText("Too many requests")).toBeInTheDocument();
		});

		it("can switch back to password mode", async () => {
			render(<LoginContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: "Email me a sign-in link" }),
			);
			await userEvent.click(
				screen.getByRole("button", { name: "Use a password instead" }),
			);

			expect(screen.getByLabelText("Password")).toBeInTheDocument();
		});
	});

	describe("Google", () => {
		it("starts the Google sign-in flow", async () => {
			vi.mocked(authClient.signIn.social).mockResolvedValue({
				data: {},
				error: null,
			} as never);

			render(<LoginContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: "Login with Google" }),
			);

			expect(authClient.signIn.social).toHaveBeenCalledWith({
				provider: "google",
				callbackURL: "/",
			});
		});

		it("shows an error if Google sign-in fails", async () => {
			vi.mocked(authClient.signIn.social).mockResolvedValue({
				data: null,
				error: { message: "Google sign-in is unavailable" },
			} as never);

			render(<LoginContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: "Login with Google" }),
			);

			expect(
				await screen.findByText("Google sign-in is unavailable"),
			).toBeInTheDocument();
		});
	});
});
