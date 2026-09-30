import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { ROLES } from "@/config/rbac";
import { prisma } from "@/services/db/prisma";
import { sendEmail } from "@/services/email/mailer";
import { hashPassword } from "@/services/auth/password";
import { invalidateUserSessionCache } from "@/services/auth/sessionStore";

const RESET_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Emails a reset link to an active admin. Unknown, inactive and non-admin
 * accounts are silently ignored so the response never reveals which exist;
 * other staff get their password reset by an admin from the users page.
 */
export async function requestPasswordReset(email: string, appUrl: string, locale: string) {
  const account = await prisma.users.findUnique({
    where: { email },
    select: { id: true, email: true, is_active: true, profiles: { select: { role: true, deleted_at: true } } },
  });
  const profile = account?.profiles;
  if (!account || !account.is_active || !profile || profile.deleted_at || profile.role !== ROLES.ADMIN) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // Only the newest link works.
    prisma.password_reset_tokens.deleteMany({ where: { user_id: account.id } }),
    prisma.password_reset_tokens.create({
      data: { id: hashToken(token), user_id: account.id, expires_at: new Date(Date.now() + RESET_TTL_MS) },
    }),
  ]);

  const link = `${appUrl}/${locale}/reset-password?token=${token}`;
  await sendEmail({
    to: account.email,
    subject: "Reset your Breezy System password",
    text: `A password reset was requested for your account.\n\nOpen this link within 30 minutes to choose a new password:\n${link}\n\nIf you did not request this, ignore this email.`,
  });
}

/** Returns false when the link is unknown, expired, already used or no longer belongs to an active admin. */
export async function resetPassword(token: string, password: string): Promise<boolean> {
  const id = hashToken(token);
  const passwordHash = await hashPassword(password);

  const userId = await prisma.$transaction(async (tx) => {
    const row = await tx.password_reset_tokens.findUnique({
      where: { id },
      select: {
        user_id: true,
        expires_at: true,
        used_at: true,
        users: { select: { is_active: true, profiles: { select: { role: true, deleted_at: true } } } },
      },
    });
    const profile = row?.users.profiles;
    if (!row || row.used_at || row.expires_at.getTime() <= Date.now()) return null;
    if (!row.users.is_active || !profile || profile.deleted_at || profile.role !== ROLES.ADMIN) return null;

    // Conditional update makes concurrent submissions of the same link single-use.
    const { count } = await tx.password_reset_tokens.updateMany({ where: { id, used_at: null }, data: { used_at: new Date() } });
    if (count === 0) return null;

    await tx.users.update({ where: { id: row.user_id }, data: { password_hash: passwordHash, updated_at: new Date() } });
    await tx.password_reset_tokens.deleteMany({ where: { user_id: row.user_id, id: { not: id } } });
    // A password reset signs the user out everywhere.
    await tx.sessions.deleteMany({ where: { user_id: row.user_id } });
    return row.user_id;
  });

  if (!userId) return false;
  invalidateUserSessionCache(userId);
  return true;
}
