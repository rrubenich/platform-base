import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { SignUpContainer } from "./sign-up.container";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signUp: { email: vi.fn() },
		signIn: { social: vi.fn() },
		useSession: () => ({ data: null }),
		updateUser: vi.fn(),
	},
}));

async function fillForm({
	password = "s3cret-pass",
	confirmPassword = password,
}: {
	password?: string;
	confirmPassword?: string;
} = {}) {
	await userEvent.type(screen.getByLabelText("Name"), "Jane Doe");
	await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
	await userEvent.type(screen.getByLabelText("Password"), password);
	await userEvent.type(
		screen.getByLabelText("Confirm password"),
		confirmPassword,
	);
	await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignUpContainer", () => {
	beforeEach(() => {
		vi.mocked(authClient.signUp.email).mockReset();
		vi.mocked(authClient.signIn.social).mockReset();
	});

	describe("email & password", () => {
		it("signs up and asks the user to verify their email", async () => {
			vi.mocked(authClient.signUp.email).mockResolvedValue({
				data: {},
				error: null,
			} as never);

			render(<SignUpContainer />);
			await fillForm();

			expect(authClient.signUp.email).toHaveBeenCalledWith({
				name: "Jane Doe",
				email: "jane@example.com",
				password: "s3cret-pass",
				locale: "en",
				callbackURL: `${window.location.origin}/`,
			});
			expect(
				await screen.findByText(
					"We sent a verification link to jane@example.com. Open it to activate your account.",
				),
			).toBeInTheDocument();
			expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
		});

		it("shows the server error on failure", async () => {
			vi.mocked(authClient.signUp.email).mockResolvedValue({
				data: null,
				error: { message: "User already exists. Use another email." },
			} as never);

			render(<SignUpContainer />);
			await fillForm();

			expect(
				await screen.findByText("User already exists. Use another email."),
			).toBeInTheDocument();
			expect(screen.getByLabelText("Password")).toBeInTheDocument();
		});

		it("rejects a password that is too short without calling the API", async () => {
			render(<SignUpContainer />);
			await fillForm({ password: "short" });

			expect(
				screen.getByText("Password must be between 8 and 128 characters."),
			).toBeInTheDocument();
			expect(authClient.signUp.email).not.toHaveBeenCalled();
		});

		it("rejects mismatched passwords without calling the API", async () => {
			render(<SignUpContainer />);
			await fillForm({ confirmPassword: "different-pass" });

			expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
			expect(authClient.signUp.email).not.toHaveBeenCalled();
		});
	});

	it("links to the sign-in page", () => {
		render(<SignUpContainer />);

		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/sign-in",
		);
	});

	describe.each([
		{ provider: "google", name: "Google" },
		{ provider: "apple", name: "Apple" },
		{ provider: "microsoft", name: "Microsoft" },
	])("$name", ({ provider, name }) => {
		it("starts the sign-up flow", async () => {
			vi.mocked(authClient.signIn.social).mockResolvedValue({
				data: {},
				error: null,
			} as never);

			render(<SignUpContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: `Sign up with ${name}` }),
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

			render(<SignUpContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: `Sign up with ${name}` }),
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

			render(<SignUpContainer />);

			await userEvent.click(
				screen.getByRole("button", { name: `Sign up with ${name}` }),
			);

			expect(
				await screen.findByText(
					`Could not sign up with ${name}. Please try again.`,
				),
			).toBeInTheDocument();
		});
	});
});
