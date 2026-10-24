import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { authClient } from "@/lib/auth-client";
import { AccountContainer } from "./account.container";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const session = vi.hoisted(() => ({
	current: {
		data: null as null | {
			user: { id: string; name: string; email: string };
			session: { token: string };
		},
		isPending: false,
		refetch: vi.fn(),
	},
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => session.current,
		listAccounts: vi.fn(),
		listSessions: vi.fn(),
		updateUser: vi.fn(),
		changeEmail: vi.fn(),
		changePassword: vi.fn(),
		revokeSession: vi.fn(),
		revokeOtherSessions: vi.fn(),
		deleteUser: vi.fn(),
		requestPasswordReset: vi.fn(),
	},
}));

const CHROME_MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const FIREFOX_LINUX =
	"Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";

const ok = { data: { status: true }, error: null } as never;

function signedIn() {
	session.current = {
		data: {
			user: { id: "user-1", name: "Jane Doe", email: "jane@example.com" },
			session: { token: "token-current" },
		},
		isPending: false,
		refetch: vi.fn(),
	};
}

function withAccounts(...providerIds: string[]) {
	vi.mocked(authClient.listAccounts).mockResolvedValue({
		data: providerIds.map((providerId) => ({ providerId })),
		error: null,
	} as never);
}

function renderAccount() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<AccountContainer />
		</QueryClientProvider>,
	);
}

/** The card titled `title`, once the page has loaded. */
const card = async (title: string) =>
	within(
		(
			await screen.findByText(title, { selector: "[data-slot=card-title]" })
		).closest("[data-slot=card]") as HTMLElement,
	);

describe("AccountContainer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		signedIn();
		withAccounts("credential");
		vi.mocked(authClient.listSessions).mockResolvedValue({
			data: [
				{
					id: "s-old",
					token: "token-old",
					userAgent: FIREFOX_LINUX,
					ipAddress: "203.0.113.7",
					createdAt: "2026-10-01T00:00:00.000Z",
				},
				{
					id: "s-current",
					token: "token-current",
					userAgent: CHROME_MAC,
					createdAt: "2026-10-20T00:00:00.000Z",
				},
			],
			error: null,
		} as never);
	});

	it("sends a signed-out visitor to sign in", async () => {
		session.current = { data: null, isPending: false, refetch: vi.fn() };
		renderAccount();

		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" }),
		);
	});

	it("links to two-factor settings and home", async () => {
		renderAccount();

		expect(
			screen.getByRole("link", { name: "Two-factor authentication" }),
		).toHaveAttribute("href", "/settings/security");
		expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
			"href",
			"/",
		);
	});

	describe("profile", () => {
		it("saves a new name and refreshes the session", async () => {
			vi.mocked(authClient.updateUser).mockResolvedValue(ok);
			renderAccount();

			const name = await screen.findByLabelText("Name");
			expect(name).toHaveValue("Jane Doe");
			const save = screen.getByRole("button", { name: "Save" });
			expect(save).toBeDisabled();

			await userEvent.clear(name);
			await userEvent.type(name, "  Jane Smith ");
			await userEvent.click(save);

			expect(authClient.updateUser).toHaveBeenCalledWith({
				name: "Jane Smith",
			});
			await waitFor(() =>
				expect(toast.success).toHaveBeenCalledWith("Profile saved."),
			);
			expect(session.current.refetch).toHaveBeenCalled();
		});
	});

	describe("email", () => {
		it("asks the current address to confirm, coming back to this page", async () => {
			vi.mocked(authClient.changeEmail).mockResolvedValue(ok);
			renderAccount();

			await userEvent.type(
				await screen.findByLabelText("New email"),
				"Jane@New.example",
			);
			await userEvent.click(
				screen.getByRole("button", { name: "Change email" }),
			);

			expect(authClient.changeEmail).toHaveBeenCalledWith({
				newEmail: "jane@new.example",
				callbackURL: `${window.location.origin}/settings/account`,
			});
			expect(
				await screen.findByText(/Check jane@example.com: confirm the change/),
			).toBeInTheDocument();
		});

		it("refuses the address it already has", async () => {
			renderAccount();

			await userEvent.type(
				await screen.findByLabelText("New email"),
				"JANE@example.com",
			);
			await userEvent.click(
				screen.getByRole("button", { name: "Change email" }),
			);

			expect(
				await screen.findByText("That's already your email."),
			).toBeInTheDocument();
			expect(authClient.changeEmail).not.toHaveBeenCalled();
		});
	});

	describe("password", () => {
		async function fill(current: string, next: string, confirm = next) {
			await userEvent.type(
				await screen.findByLabelText("Current password"),
				current,
			);
			await userEvent.type(screen.getByLabelText("New password"), next);
			await userEvent.type(
				screen.getByLabelText("Confirm new password"),
				confirm,
			);
		}

		it("changes it and signs out the other devices by default", async () => {
			vi.mocked(authClient.changePassword).mockResolvedValue(ok);
			renderAccount();

			await fill("old-password", "new-password-1");
			await userEvent.click(
				screen.getByRole("button", { name: "Change password" }),
			);

			expect(authClient.changePassword).toHaveBeenCalledWith({
				currentPassword: "old-password",
				newPassword: "new-password-1",
				revokeOtherSessions: true,
			});
			await waitFor(() =>
				expect(toast.success).toHaveBeenCalledWith("Password changed."),
			);
		});

		it("checks the confirmation and length before asking the server", async () => {
			renderAccount();

			await fill("old-password", "new-password-1", "new-password-2");
			await userEvent.click(
				screen.getByRole("button", { name: "Change password" }),
			);
			expect(
				await screen.findByText("The passwords don't match."),
			).toBeInTheDocument();

			await userEvent.clear(screen.getByLabelText("New password"));
			await userEvent.type(screen.getByLabelText("New password"), "short");
			await userEvent.click(
				screen.getByRole("button", { name: "Change password" }),
			);
			expect(
				await screen.findByText("Use at least 8 characters."),
			).toBeInTheDocument();
			expect(authClient.changePassword).not.toHaveBeenCalled();
		});

		it("shows the server's error, e.g. a wrong current password", async () => {
			vi.mocked(authClient.changePassword).mockResolvedValue({
				data: null,
				error: { status: 400, message: "Invalid password" },
			} as never);
			renderAccount();

			await fill("wrong-password", "new-password-1");
			await userEvent.click(
				screen.getByRole("button", { name: "Change password" }),
			);

			expect(await screen.findByText("Invalid password")).toBeInTheDocument();
		});

		it("has nothing to change for an account without a password", async () => {
			withAccounts("google");
			renderAccount();

			expect(
				await screen.findByText(/Set a password to also sign in/),
			).toBeInTheDocument();
			expect(screen.queryByLabelText("Current password")).toBeNull();
		});

		it("emails an account without a password a link to set one", async () => {
			withAccounts("google");
			vi.mocked(authClient.requestPasswordReset).mockResolvedValue(ok);
			renderAccount();

			await userEvent.click(
				await screen.findByRole("button", {
					name: "Email me a link to set one",
				}),
			);

			expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
				email: "jane@example.com",
				redirectTo: `${window.location.origin}/reset-password`,
			});
			expect(await screen.findByRole("status")).toHaveTextContent(
				"Check jane@example.com for a link to set your password.",
			);
		});
	});

	describe("sessions", () => {
		it("lists the devices, this one first and marked", async () => {
			renderAccount();

			const sessions = await card("Where you're signed in");
			const items = await sessions.findAllByRole("listitem");
			expect(items[0]).toHaveTextContent("Chrome on macOS");
			expect(items[0]).toHaveTextContent("This device");
			expect(within(items[0]).queryByRole("button")).toBeNull();
			expect(items[1]).toHaveTextContent("Firefox on Linux");
			expect(items[1]).toHaveTextContent("203.0.113.7");
		});

		it("signs out of one device, or every other one", async () => {
			vi.mocked(authClient.revokeSession).mockResolvedValue(ok);
			vi.mocked(authClient.revokeOtherSessions).mockResolvedValue(ok);
			renderAccount();

			const sessions = await card("Where you're signed in");
			await userEvent.click(
				await sessions.findByRole("button", { name: "Sign out" }),
			);
			expect(authClient.revokeSession).toHaveBeenCalledWith({
				token: "token-old",
			});

			await userEvent.click(
				sessions.getByRole("button", { name: "Sign out of all other devices" }),
			);
			expect(authClient.revokeOtherSessions).toHaveBeenCalled();
			await waitFor(() =>
				expect(toast.success).toHaveBeenCalledWith(
					"Signed out of every other device.",
				),
			);
		});
	});

	describe("delete account", () => {
		it("deletes it with the password, then goes to sign in", async () => {
			vi.mocked(authClient.deleteUser).mockResolvedValue(ok);
			renderAccount();

			await userEvent.click(
				await screen.findByRole("button", { name: "Delete account" }),
			);
			await userEvent.type(
				await screen.findByLabelText("Enter your password to confirm"),
				"s3cret-pass",
			);
			await userEvent.click(
				screen.getByRole("button", { name: "Delete my account" }),
			);

			expect(authClient.deleteUser).toHaveBeenCalledWith({
				password: "s3cret-pass",
			});
			await waitFor(() =>
				expect(navigate).toHaveBeenCalledWith({ to: "/sign-in" }),
			);
		});

		it("shows why it was refused, e.g. the only owner of an organization", async () => {
			const refusal =
				"You are the only owner of an organization. Transfer ownership or delete the organization before deleting your account.";
			vi.mocked(authClient.deleteUser).mockResolvedValue({
				data: null,
				error: { status: 403, message: refusal },
			} as never);
			renderAccount();

			await userEvent.click(
				await screen.findByRole("button", { name: "Delete account" }),
			);
			await userEvent.type(
				await screen.findByLabelText("Enter your password to confirm"),
				"s3cret-pass",
			);
			await userEvent.click(
				screen.getByRole("button", { name: "Delete my account" }),
			);

			expect(await screen.findByText(refusal)).toBeInTheDocument();
			expect(navigate).not.toHaveBeenCalled();
		});

		it("relies on a recent sign-in for an account without a password", async () => {
			withAccounts("google");
			vi.mocked(authClient.deleteUser).mockResolvedValue(ok);
			renderAccount();

			await screen.findByText(/Set a password to also sign in/);
			await userEvent.click(
				screen.getByRole("button", { name: "Delete account" }),
			);
			expect(
				await screen.findByText(/signed in within the last day/),
			).toBeInTheDocument();
			await userEvent.click(
				screen.getByRole("button", { name: "Delete my account" }),
			);

			expect(authClient.deleteUser).toHaveBeenCalledWith({});
		});
	});
});
