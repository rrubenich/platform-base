import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
	BadRequestException,
	ConflictException,
	GoneException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { m } from "@workspace/i18n/messages";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AUTH_INSTANCE } from "../auth/auth.constants.js";
import { DATABASE_CONNECTION } from "../database/database.module.js";
import * as schema from "../database/schema.js";
import type { Locale } from "../i18n/i18n.js";
import { escapeHtml, sendEmail } from "../lib/email.js";
import {
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
} from "./account-invitations.dto.js";

const { accountInvitation, organization, user, account, session } = schema;

type Db = NodePgDatabase<typeof schema>;

/** How long the link to set up an account stays valid. */
export const ACCOUNT_INVITATION_EXPIRY_DAYS = 7;
const EXPIRY_MS = ACCOUNT_INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// `auth` is typed against the generic `BetterAuthOptions` (see lib/auth.ts),
// which erases the plugins' endpoints from its static type.
export type AccountInvitationsAuthApi = {
	api: {
		createUser: (input: {
			body: { email: string; name: string; role: "user" };
		}) => Promise<{ user: { id: string } }>;
		createOrganization: (input: {
			body: { name: string; slug: string; userId: string };
		}) => Promise<{ id: string } | null>;
	};
	$context: Promise<{
		password: { hash: (password: string) => Promise<string> };
	}>;
};

export type InvitationStatus = "pending" | "expired" | "accepted";

export type OwnerSetup = {
	id: string;
	email: string;
	expiresAt: Date;
	status: InvitationStatus;
};

type InvitationRow = typeof accountInvitation.$inferSelect;

export function statusOf(
	row: Pick<InvitationRow, "acceptedAt" | "expiresAt">,
	now = new Date(),
): InvitationStatus {
	if (row.acceptedAt) return "accepted";
	return row.expiresAt <= now ? "expired" : "pending";
}

const hashToken = (token: string) =>
	createHash("sha256").update(token).digest("hex");

const newToken = () => {
	const token = randomBytes(32).toString("base64url");
	return { token, tokenHash: hashToken(token) };
};

const toOwnerSetup = (row: InvitationRow): OwnerSetup => ({
	id: row.id,
	email: row.email,
	expiresAt: row.expiresAt,
	status: statusOf(row),
});

/**
 * Accounts a superadmin creates: the user (no password yet) as owner of a
 * new organization, and the emailed link where they set name and password.
 * Only the token's hash is stored; the link is the credential.
 */
@Injectable()
export class AccountInvitationsService {
	constructor(
		@Inject(DATABASE_CONNECTION) private readonly db: Db,
		@Inject(AUTH_INSTANCE) private readonly auth: AccountInvitationsAuthApi,
	) {}

	async create(
		input: { email: string; organizationName: string; slug: string },
		invitedBy: { id: string; name: string },
		locale: Locale,
	): Promise<{ id: string; organizationId: string; userId: string }> {
		const email = input.email.trim().toLowerCase();
		const [existingUser] = await this.db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, email));
		if (existingUser) {
			throw new ConflictException({
				message: "Email is already in use",
				code: "EMAIL_TAKEN",
			});
		}
		await this.assertSlugFree(input.slug);

		// Signs in later with the name they choose; the email stands in.
		const { user: created } = await this.auth.api.createUser({
			body: { email, name: email, role: "user" },
		});
		let organizationId: string | undefined;
		try {
			organizationId = await this.createOrganization(
				input.organizationName,
				input.slug,
				created.id,
			);
			const { token, tokenHash } = newToken();
			const id = randomUUID();
			await this.db.insert(accountInvitation).values({
				id,
				email,
				userId: created.id,
				organizationId,
				invitedById: invitedBy.id,
				tokenHash,
				expiresAt: new Date(Date.now() + EXPIRY_MS),
			});
			await this.sendInvitation(
				{ email, organizationName: input.organizationName, token },
				invitedBy.name,
				locale,
			);
			return { id, organizationId, userId: created.id };
		} catch (error) {
			if (organizationId) await this.deleteOrganization(organizationId);
			await this.db.delete(user).where(eq(user.id, created.id));
			throw error;
		}
	}

	async resend(
		id: string,
		inviterName: string,
		locale: Locale,
	): Promise<OwnerSetup> {
		const row = await this.find(id);
		this.assertNotAccepted(row);
		const { token, tokenHash } = newToken();
		const [updated] = await this.db
			.update(accountInvitation)
			.set({ tokenHash, expiresAt: new Date(Date.now() + EXPIRY_MS) })
			.where(
				and(eq(accountInvitation.id, id), isNull(accountInvitation.acceptedAt)),
			)
			.returning();
		if (!updated) this.assertNotAccepted({ acceptedAt: new Date() });
		await this.sendInvitation(
			{
				email: updated.email,
				organizationName: await this.organizationName(updated.organizationId),
				token,
			},
			inviterName,
			locale,
		);
		return toOwnerSetup(updated);
	}

	/** Deletes the pending account and its organization. */
	async cancel(id: string): Promise<void> {
		const row = await this.find(id);
		this.assertNotAccepted(row);
		await this.deleteOrganization(row.organizationId);
		// Takes the invitation with it (ON DELETE CASCADE).
		await this.db.delete(user).where(eq(user.id, row.userId));
	}

	async preview(
		token: string,
	): Promise<{ email: string; organizationName: string }> {
		const row = await this.findUsable(token);
		return {
			email: row.email,
			organizationName: await this.organizationName(row.organizationId),
		};
	}

	/**
	 * Sets the name and password and verifies the email (the link proves
	 * it). Doesn't sign in: the web does that with the new password.
	 */
	async accept(
		token: string,
		input: { name: string; password: string },
	): Promise<{ email: string }> {
		if (
			input.password.length < MIN_PASSWORD_LENGTH ||
			input.password.length > MAX_PASSWORD_LENGTH
		) {
			throw new BadRequestException(
				`Password must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters`,
			);
		}
		await this.findUsable(token);
		const password = await (await this.auth.$context).password.hash(
			input.password,
		);

		const accepted = await this.db.transaction(async (tx) => {
			const now = new Date();
			// Conditional, so of two concurrent accepts only one gets the row.
			const [row] = await tx
				.update(accountInvitation)
				.set({ acceptedAt: now })
				.where(
					and(
						eq(accountInvitation.tokenHash, hashToken(token)),
						isNull(accountInvitation.acceptedAt),
						gt(accountInvitation.expiresAt, now),
					),
				)
				.returning();
			if (!row) return undefined;
			await tx.insert(account).values({
				id: randomUUID(),
				accountId: row.userId,
				providerId: "credential",
				userId: row.userId,
				password,
				createdAt: now,
				updatedAt: now,
			});
			await tx
				.update(user)
				.set({ name: input.name.trim(), emailVerified: true })
				.where(eq(user.id, row.userId));
			return row;
		});
		// Lost the race, or expired meanwhile: answer as a fresh lookup would.
		if (!accepted) await this.findUsable(token);
		return { email: (accepted as InvitationRow).email };
	}

	/** The organization's owner setup while it's not done; null after. */
	async forOrganization(organizationId: string): Promise<OwnerSetup | null> {
		const [row] = await this.db
			.select()
			.from(accountInvitation)
			.where(eq(accountInvitation.organizationId, organizationId))
			.orderBy(desc(accountInvitation.createdAt))
			.limit(1);
		return row && !row.acceptedAt ? toOwnerSetup(row) : null;
	}

	/** Owner setups not yet done, for these users. */
	async forUsers(
		userIds: string[],
	): Promise<(OwnerSetup & { userId: string })[]> {
		const rows = await this.db
			.select()
			.from(accountInvitation)
			.where(
				and(
					inArray(accountInvitation.userId, userIds),
					isNull(accountInvitation.acceptedAt),
				),
			);
		return rows.map((row) => ({ ...toOwnerSetup(row), userId: row.userId }));
	}

	private async find(id: string): Promise<InvitationRow> {
		const [row] = await this.db
			.select()
			.from(accountInvitation)
			.where(eq(accountInvitation.id, id));
		if (!row) throw new NotFoundException("Invitation not found");
		return row;
	}

	private async findUsable(token: string): Promise<InvitationRow> {
		const [row] = await this.db
			.select()
			.from(accountInvitation)
			.where(eq(accountInvitation.tokenHash, hashToken(token)));
		if (!row) throw new NotFoundException("Invitation not found");
		const status = statusOf(row);
		if (status === "accepted") {
			throw new GoneException({
				message: "This invitation was already used",
				code: "INVITATION_ACCEPTED",
			});
		}
		if (status === "expired") {
			throw new GoneException({
				message: "This invitation expired",
				code: "INVITATION_EXPIRED",
			});
		}
		return row;
	}

	private assertNotAccepted(row: Pick<InvitationRow, "acceptedAt">) {
		if (row.acceptedAt) {
			throw new ConflictException({
				message: "The account is already set up",
				code: "ALREADY_ACCEPTED",
			});
		}
	}

	private async assertSlugFree(slug: string) {
		const [taken] = await this.db
			.select({ id: organization.id })
			.from(organization)
			.where(eq(organization.slug, slug));
		if (taken) throw slugTaken();
	}

	private async createOrganization(
		name: string,
		slug: string,
		userId: string,
	): Promise<string> {
		try {
			const created = await this.auth.api.createOrganization({
				body: { name, slug, userId },
			});
			if (!created) throw new Error("Failed to create the organization");
			return created.id;
		} catch (error) {
			// Taken between the check and the insert.
			const code = (error as { body?: { code?: string } }).body?.code;
			if (code === "ORGANIZATION_ALREADY_EXISTS") throw slugTaken();
			throw error;
		}
	}

	private async deleteOrganization(id: string) {
		// Members, teams and invitations go with it (ON DELETE CASCADE).
		await this.db.delete(organization).where(eq(organization.id, id));
		await this.db
			.update(session)
			.set({ activeOrganizationId: null, activeTeamId: null })
			.where(eq(session.activeOrganizationId, id));
	}

	private async organizationName(id: string): Promise<string> {
		const [found] = await this.db
			.select({ name: organization.name })
			.from(organization)
			.where(eq(organization.id, id));
		return found?.name ?? "";
	}

	private async sendInvitation(
		{
			email,
			organizationName,
			token,
		}: { email: string; organizationName: string; token: string },
		inviterName: string,
		locale: Locale,
	) {
		const url = `${process.env.WEB_URL ?? "http://localhost:5173"}/welcome/${token}`;
		await sendEmail({
			to: email,
			subject: m.email_account_invitation_subject(
				{ organization: organizationName },
				{ locale },
			),
			html: [
				`<p>${escapeHtml(
					m.email_account_invitation_body(
						{ inviter: inviterName, organization: organizationName },
						{ locale },
					),
				)}</p>`,
				`<p><a href="${url}">${m.email_account_invitation_link({}, { locale })}</a></p>`,
				`<p>${m.email_invitation_expiry({ days: ACCOUNT_INVITATION_EXPIRY_DAYS }, { locale })}</p>`,
			].join(""),
		});
	}
}

const slugTaken = () =>
	new ConflictException({
		message: "Slug is already taken",
		code: "SLUG_TAKEN",
	});
