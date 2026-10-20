import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { InvitationContainer } from "./invitation.container";

const navigate = vi.fn();
let search: Record<string, unknown> = {};
const session: { current: { data: unknown; isPending: boolean } } = {
	current: { data: null, isPending: false },
};

vi.mock("@tanstack/react-router", () => ({
	useParams: () => ({ invitationId: "i1" }),
	useSearch: () => search,
	useNavigate: () => navigate,
	Link: ({
		to,
		search,
		children,
	}: {
		to: string;
		search?: Record<string, string>;
		children: React.ReactNode;
	}) => (
		<a
			href={`${to}${search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : ""}`}
		>
			{children}
		</a>
	),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => session.current,
		signOut: vi.fn(),
		organization: {
			getInvitation: vi.fn(),
			acceptInvitation: vi.fn(),
			rejectInvitation: vi.fn(),
		},
	},
}));

const invitation = {
	id: "i1",
	email: "jane@example.com",
	role: "admin",
	organizationName: "Acme",
	inviterEmail: "boss@example.com",
	status: "pending",
};

const signedInAs = (email: string) => {
	session.current = { data: { user: { email } }, isPending: false };
};

const renderPage = () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<InvitationContainer />
		</QueryClientProvider>,
	);
};

const org = authClient.organization;

describe("InvitationContainer", () => {
	beforeEach(() => {
		search = { email: "jane@example.com" };
		session.current = { data: null, isPending: false };
		navigate.mockReset();
		vi.mocked(authClient.signOut).mockReset();
		for (const fn of Object.values(org)) vi.mocked(fn).mockReset();
	});

	it("offers sign in and sign up when signed out, without loading the invitation", () => {
		renderPage();

		const redirect = "%2Finvitations%2Fi1%3Femail%3Djane%2540example.com";
		const query = `redirect=${redirect}&email=jane%40example.com`;
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			`/sign-in?${query}`,
		);
		expect(
			screen.getByRole("link", { name: "Create account" }),
		).toHaveAttribute("href", `/sign-up?${query}`);
		expect(org.getInvitation).not.toHaveBeenCalled();
	});

	it("explains a different signed-in email and switches accounts", async () => {
		signedInAs("other@example.com");
		vi.mocked(authClient.signOut).mockResolvedValue({} as never);

		renderPage();

		expect(
			screen.getByText(/signed in as other@example.com/),
		).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", {
				name: "Sign out and continue as jane@example.com",
			}),
		);

		expect(authClient.signOut).toHaveBeenCalled();
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({
				to: "/sign-in",
				search: {
					redirect: "/invitations/i1?email=jane%40example.com",
					email: "jane@example.com",
				},
			}),
		);
		expect(org.getInvitation).not.toHaveBeenCalled();
	});

	it("shows the invitation and accepts it", async () => {
		signedInAs("jane@example.com");
		vi.mocked(org.getInvitation).mockResolvedValue({
			data: invitation,
			error: null,
		} as never);
		vi.mocked(org.acceptInvitation).mockResolvedValue({
			data: {},
			error: null,
		} as never);

		renderPage();

		expect(await screen.findByText("Acme")).toBeInTheDocument();
		expect(screen.getByText(/boss@example.com/)).toBeInTheDocument();
		expect(screen.getByText("Role: Admin")).toBeInTheDocument();
		expect(org.getInvitation).toHaveBeenCalledWith({ query: { id: "i1" } });

		await userEvent.click(
			screen.getByRole("button", { name: "Accept invitation" }),
		);

		expect(org.acceptInvitation).toHaveBeenCalledWith({ invitationId: "i1" });
		await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
	});

	it("declines the invitation", async () => {
		signedInAs("jane@example.com");
		vi.mocked(org.getInvitation).mockResolvedValue({
			data: invitation,
			error: null,
		} as never);
		vi.mocked(org.rejectInvitation).mockResolvedValue({
			data: {},
			error: null,
		} as never);

		renderPage();

		await userEvent.click(
			await screen.findByRole("button", { name: "Decline" }),
		);

		expect(org.rejectInvitation).toHaveBeenCalledWith({ invitationId: "i1" });
		expect(await screen.findByText("Invitation declined")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
			"href",
			"/",
		);
	});

	it("shows an unavailable message for an unknown invitation", async () => {
		signedInAs("jane@example.com");
		vi.mocked(org.getInvitation).mockResolvedValue({
			data: null,
			error: { status: 400, message: "Invitation not found!" },
		} as never);

		renderPage();

		expect(
			await screen.findByText("Invitation unavailable"),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
			"href",
			"/",
		);
	});

	it("asks an unverified invitee to verify and offers sign out", async () => {
		signedInAs("jane@example.com");
		vi.mocked(org.getInvitation).mockResolvedValue({
			data: null,
			error: {
				status: 403,
				code: "EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION",
				message: "Email verification required",
			},
		} as never);
		vi.mocked(authClient.signOut).mockResolvedValue({} as never);

		renderPage();

		expect(
			await screen.findByText("Verify your email first"),
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
		expect(authClient.signOut).toHaveBeenCalled();
	});

	it("offers retry and home when loading fails", async () => {
		signedInAs("jane@example.com");
		vi.mocked(org.getInvitation).mockResolvedValue({
			data: null,
			error: { status: 500, message: "Boom" },
		} as never);

		renderPage();

		expect(await screen.findByText("Boom")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Go home" })).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(org.getInvitation).toHaveBeenCalledTimes(2);
	});

	it("shows the server's message when accepting fails", async () => {
		signedInAs("jane@example.com");
		vi.mocked(org.getInvitation).mockResolvedValue({
			data: invitation,
			error: null,
		} as never);
		vi.mocked(org.acceptInvitation).mockResolvedValue({
			data: null,
			error: {
				code: "ALREADY_IN_AN_ORGANIZATION",
				message:
					"You already belong to an organization. Leave it before accepting another invitation.",
			},
		} as never);

		renderPage();

		await userEvent.click(
			await screen.findByRole("button", { name: "Accept invitation" }),
		);

		expect(
			await screen.findByText(/You already belong to an organization/),
		).toBeInTheDocument();
		expect(navigate).not.toHaveBeenCalled();
	});
});
