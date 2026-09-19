import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/services/db/prisma";
import { isUserRole, type UserRole } from "@/types/auth";

export const SESSION_COOKIE_NAME = "bi_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Extend the session when less than half of its lifetime remains.
const RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface ValidatedSession {
  user: SessionUser;
  expiresAt: Date;
  renewed: boolean;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function createSession(
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.sessions.create({
    data: {
      id: hashToken(token),
      user_id: userId,
      expires_at: expiresAt,
      ip_address: meta.ipAddress ?? null,
      user_agent: meta.userAgent?.slice(0, 512) ?? null,
    },
  });

  return { token, expiresAt };
}

/**
 * Resolves a raw session token to the active user. Returns null (and removes the
 * row) when the session expired, the account was disabled or the profile deleted.
 */
export async function validateSessionToken(token: string | undefined | null): Promise<ValidatedSession | null> {
  if (!token || token.length > 128) return null;

  const id = hashToken(token);
  const session = await prisma.sessions.findUnique({
    where: { id },
    select: {
      expires_at: true,
      users: {
        select: {
          id: true,
          email: true,
          is_active: true,
          profiles: { select: { name: true, role: true, deleted_at: true } },
        },
      },
    },
  });

  if (!session) return null;

  const { users: user } = session;
  const profile = user.profiles;
  const now = Date.now();

  if (session.expires_at.getTime() <= now || !user.is_active || !profile || profile.deleted_at || !isUserRole(profile.role)) {
    await prisma.sessions.deleteMany({ where: { id } });
    return null;
  }

  let expiresAt = session.expires_at;
  let renewed = false;
  if (expiresAt.getTime() - now < RENEW_THRESHOLD_MS) {
    expiresAt = new Date(now + SESSION_TTL_MS);
    renewed = true;
    await prisma.sessions.update({ where: { id }, data: { expires_at: expiresAt, last_seen_at: new Date(now) } });
  }

  return {
    user: { id: user.id, email: user.email, name: profile.name, role: profile.role },
    expiresAt,
    renewed,
  };
}

export async function deleteSession(token: string | undefined | null) {
  if (!token) return;
  await prisma.sessions.deleteMany({ where: { id: hashToken(token) } });
}

export async function deleteUserSessions(userId: string) {
  await prisma.sessions.deleteMany({ where: { user_id: userId } });
}

export async function deleteExpiredSessions() {
  await prisma.sessions.deleteMany({ where: { expires_at: { lte: new Date() } } });
}
