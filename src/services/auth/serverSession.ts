import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, validateSessionToken } from "@/services/auth/sessionStore";
import type { UserRole } from "@/types/auth";

export type AuthAccessErrorCode =
  | "auth/invalid_session"
  | "auth/permission_denied"
  | "auth/requires_authenticated_user";

export class AuthAccessError extends Error {
  constructor(readonly code: AuthAccessErrorCode) {
    super(code);
    this.name = "AuthAccessError";
  }
}

export interface VerifiedSession {
  id: string;
  email: string | null;
  role: UserRole;
}

/** Validates a raw session token (as stored in the session cookie). */
export async function verifyServerToken(token: string): Promise<VerifiedSession> {
  if (!token) throw new AuthAccessError("auth/requires_authenticated_user");

  const session = await validateSessionToken(token);
  if (!session) throw new AuthAccessError("auth/invalid_session");

  const { id, email, role } = session.user;
  return { id, email, role };
}

export const getCurrentServerSession = cache(async function getCurrentServerSession(): Promise<VerifiedSession> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new AuthAccessError("auth/requires_authenticated_user");

  return verifyServerToken(token);
});
