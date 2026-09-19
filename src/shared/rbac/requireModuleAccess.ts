import "server-only";

import { canAccessModule, canPerformAction, type ActionPermission, type PermissionModule } from "@/config/rbac";
import type { Locale } from "@/i18n/config";
import { AuthAccessError, getCurrentServerSession } from "@/services/auth/serverSession";
import { redirect } from "next/navigation";

export async function requireModuleAccess(module: PermissionModule) {
  const session = await getCurrentServerSession();

  if (!canAccessModule(session.role, module)) {
    throw new AuthAccessError("auth/permission_denied");
  }

  return session;
}

export async function requireActionAccess(action: ActionPermission) {
  const session = await getCurrentServerSession();

  if (!canPerformAction(session.role, action)) {
    throw new AuthAccessError("auth/permission_denied");
  }

  return session;
}

export async function enforceModuleAccess(module: PermissionModule, locale: Locale, nextPath: string) {
  try {
    return await requireModuleAccess(module);
  } catch (error) {
    if (error instanceof AuthAccessError) {
      const target = error.code === "auth/permission_denied" ? "unauthorized" : "login";
      const next = target === "login" ? `?next=${encodeURIComponent(nextPath)}` : "";
      redirect(`/${locale}/${target}${next}`);
    }

    throw error;
  }
}

export async function enforceActionAccess(action: ActionPermission, locale: Locale, nextPath: string) {
  try {
    return await requireActionAccess(action);
  } catch (error) {
    if (error instanceof AuthAccessError) {
      const target = error.code === "auth/permission_denied" ? "unauthorized" : "login";
      const next = target === "login" ? `?next=${encodeURIComponent(nextPath)}` : "";
      redirect(`/${locale}/${target}${next}`);
    }

    throw error;
  }
}
