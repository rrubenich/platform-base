import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { SignInContainer } from "./sign-in.container";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: {
			email: vi.fn(),
			magicLink: vi.fn(),
			social: vi.fn(),
		},
		useSession: () => ({ data: null }),
		updateUser: vi.fn(),
	},
}));

describe("SignInContainer", () => {
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

			render(<SignInContainer />);

			await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
			await userEvent.type(screen.getByLabelText("Password"), "s3cret-pass");
			await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

			expect(authClient.signIn.email).toHaveBeenCalledWith({
				email: "jane@example.com",
				password: "s3cret-pass",
				callbackURL: `${window.location.origin}/`,
			});
			expect(navigate).toHaveBeenCalledWith({ to: "/" });
		});

		it("sends users with two-factor auth on to /two-factor", async () => {
			vi.mocked(authClient.signIn.email).mockResolvedValue({
				data: { twoFactorRedirect: true, twoFactorMethods: ["totp", "otp"] },
				error: null,
			} as never);

			render(<SignInContainer />);

			await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
			await userEvent.type(screen.getByLabelText("Password"), "s3cret-pass");
			await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

			expect(navigate).toHaveBeenCalledWith({ to: "/two-factor" });
			expect(navigate).not.toHaveBeenCalledWith({ to: "/" });
		});

		it("shows an error and does not navigate on failure", async () => {
			vi.mocked(authClient.signIn.email).mockResolvedValue({
				data: null,
				error: { message: "Invalid email or password" },
			} as never);

			render(<SignInContainer />);

			await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
			await userEvent.type(screen.getByLabelText("Password"), "wrong-pass");
			await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

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

			render(<SignInContainer />);

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
				callbackURL: `${window.location.origin}/`,
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

			render(<SignInContainer />);

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
			render(<SignInContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: "Email me a sign-in link" }),
			);
			await userEvent.click(
				screen.getByRole("button", { name: "Use a password instead" }),
			);

			expect(screen.getByLabelText("Password")).toBeInTheDocument();
		});
	});

	it("links to the sign-up page", () => {
		render(<SignInContainer />);

		expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
			"href",
			"/sign-up",
		);
	});

	describe.each([
		{ provider: "google", name: "Google" },
		{ provider: "apple", name: "Apple" },
		{ provider: "microsoft", name: "Microsoft" },
	])("$name", ({ provider, name }) => {
		it("starts the sign-in flow", async () => {
			vi.mocked(authClient.signIn.social).mockResolvedValue({
				data: {},
				error: null,
			} as never);

			render(<SignInContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: `Sign in with ${name}` }),
			);

			expect(authClient.signIn.social).toHaveBeenCalledWith({
				provider,
				callbackURL: `${window.location.origin}/`,
			});
		});

		it("shows the server error if it fails", async () => {
			vi.mocked(authClient.signIn.social).mockResolvedValue({
				data: null,
				error: { message: `${name} sign-in is unavailable` },
			} as never);

			render(<SignInContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: `Sign in with ${name}` }),
			);

			expect(
				await screen.findByText(`${name} sign-in is unavailable`),
			).toBeInTheDocument();
		});

		it("falls back to a provider-specific message", async () => {
			vi.mocked(authClient.signIn.social).mockResolvedValue({
				data: null,
				error: {},
			} as never);

			render(<SignInContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: `Sign in with ${name}` }),
			);

			expect(
				await screen.findByText(
					`Could not sign in with ${name}. Please try again.`,
				),
			).toBeInTheDocument();
		});
	});
});
