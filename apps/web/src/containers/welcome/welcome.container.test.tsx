import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { accountInvitationsApi } from "@/lib/account-invitations-api";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { WelcomeContainer } from "./welcome.container";

const navigate = vi.fn();
const session: { current: { data: unknown; isPending: boolean } } = {
	current: { data: null, isPending: false },
};

vi.mock("@tanstack/react-router", () => ({
	useParams: () => ({ token: "tok-1" }),
	useNavigate: () => navigate,
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => session.current,
		signOut: vi.fn(),
		signIn: { email: vi.fn() },
	},
}));

vi.mock("@/lib/account-invitations-api", () => ({
	accountInvitationsApi: { preview: vi.fn(), accept: vi.fn() },
}));

const api = accountInvitationsApi;

const renderPage = () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<WelcomeContainer />
		</QueryClientProvider>,
	);
};

async function fillForm({
	name = "Jane Client",
	password = "s3cret-pass",
	confirm,
}: {
	name?: string;
	password?: string;
	confirm?: string;
} = {}) {
	await userEvent.type(await screen.findByLabelText("Your name"), name);
	await userEvent.type(screen.getByLabelText("Password"), password);
	await userEvent.type(
		screen.getByLabelText("Confirm password"),
		confirm ?? password,
	);
	await userEvent.click(
		screen.getByRole("button", { name: "Create my login" }),
	);
}

describe("WelcomeContainer", () => {
	beforeEach(() => {
		session.current = { data: null, isPending: false };
		navigate.mockReset();
		vi.mocked(authClient.signOut).mockReset();
		vi.mocked(authClient.signIn.email).mockReset();
		vi.mocked(api.preview).mockReset().mockResolvedValue({
			email: "jane@acme.com",
			organizationName: "Acme",
		});
		vi.mocked(api.accept).mockReset();
	});

	it("shows the organization and the invited email, read-only", async () => {
		renderPage();

		expect(
			await screen.findByText(
				"You've been invited to manage Acme on Platform Base.",
			),
		).toBeInTheDocument();
		const email = screen.getByLabelText("Email");
		expect(email).toHaveValue("jane@acme.com");
		expect(email).toHaveAttribute("readonly");
		expect(api.preview).toHaveBeenCalledWith("tok-1");
	});

	it("sets up the login, signs in and goes to the workspace", async () => {
		vi.mocked(api.accept).mockResolvedValue({ email: "jane@acme.com" });
		vi.mocked(authClient.signIn.email).mockResolvedValue({
			data: {},
			error: null,
		} as never);
		renderPage();

		await fillForm();

		await waitFor(() =>
			expect(api.accept).toHaveBeenCalledWith("tok-1", {
				name: "Jane Client",
				password: "s3cret-pass",
			}),
		);
		expect(authClient.signIn.email).toHaveBeenCalledWith({
			email: "jane@acme.com",
			password: "s3cret-pass",
		});
		await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
	});

	it("checks the password before calling the API", async () => {
		renderPage();

		await fillForm({ password: "short" });
		expect(
			await screen.findByText(/Password must be between 8 and 128/),
		).toBeInTheDocument();

		await userEvent.clear(screen.getByLabelText("Password"));
		await userEvent.clear(screen.getByLabelText("Confirm password"));
		await userEvent.type(screen.getByLabelText("Password"), "s3cret-pass");
		await userEvent.type(
			screen.getByLabelText("Confirm password"),
			"other-pass",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Create my login" }),
		);
		expect(
			await screen.findByText("Passwords do not match."),
		).toBeInTheDocument();
		expect(api.accept).not.toHaveBeenCalled();
	});

	it("says when the link expired", async () => {
		vi.mocked(api.preview).mockRejectedValue(
			new ApiError(410, "This invitation expired", "INVITATION_EXPIRED"),
		);

		renderPage();

		expect(
			await screen.findByText(
				"This link has expired. Ask whoever invited you to send a new one.",
			),
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Password")).toBeNull();
	});

	it("sends an already set-up account to sign in", async () => {
		vi.mocked(api.preview).mockRejectedValue(
			new ApiError(
				410,
				"This invitation was already used",
				"INVITATION_ACCEPTED",
			),
		);

		renderPage();

		expect(
			await screen.findByText("Your account is already set up."),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/sign-in",
		);
	});

	it("says when the link isn't valid", async () => {
		vi.mocked(api.preview).mockRejectedValue(
			new ApiError(404, "Invitation not found"),
		);

		renderPage();

		expect(
			await screen.findByText("This link isn't valid."),
		).toBeInTheDocument();
	});

	it("asks a signed-in visitor to sign out first", async () => {
		session.current = {
			data: { user: { email: "someone@else.com" } },
			isPending: false,
		};
		vi.mocked(authClient.signOut).mockResolvedValue({
			data: {},
			error: null,
		} as never);
		renderPage();

		expect(
			await screen.findByText(/You're signed in as someone@else.com/),
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Password")).toBeNull();

		await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
		expect(authClient.signOut).toHaveBeenCalled();
	});
});
