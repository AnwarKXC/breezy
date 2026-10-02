"use client";

import { memo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/modules/auth";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { ChevronIcon } from "./LayoutIcons";
import Image from "next/image";

interface ProfileMenuProps {
  localePrefix: string;
  t: (key: string) => string;
}

export const ProfileMenu = memo(function ProfileMenu({
  localePrefix,
  t,
}: ProfileMenuProps) {
  const router = useRouter();
  const { loading, logout, user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(closeMenu);

  const handleLogout = useCallback(async () => {
    setLogoutError(null);

    try {
      await logout();
      setOpen(false);
      router.replace(`${localePrefix}/login`);
    } catch {
      setLogoutError(t("auth.errors.logoutFailed"));
    }
  }, [localePrefix, logout, router, t]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        aria-label={t("layout.profile")}
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white pe-2 ps-1 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-ink text-xs font-bold text-white">
          {role === "admin" ? (
            <Image
              alt={t("layout.profile")}
              className="h-7 w-7 rounded-full object-cover"
              height={32}
              src="/Profile Picture Green.jpg"
              width={32}
            />
          ) : (
            <Image
              alt={t("layout.profile")}
              className="h-7 w-7 rounded-full object-cover"
              height={32}
              src="/Profile Picture White.jpg"
              width={32}
            />
          )}
        </span>
        <span className="hidden max-w-40 truncate sm:block" title={user?.email ?? undefined}>
          {user?.displayName || user?.email || t("layout.admin")}
        </span>
        <span className="hidden text-[#787774] sm:block"><ChevronIcon /></span>
      </button>

      {open ? (
        <div className="absolute end-0 top-12 z-40 w-48 overflow-hidden rounded-xl border border-line bg-white p-2 text-sm shadow-lg">
          <button
            className="block w-full rounded-md px-3 py-2 text-start font-bold text-[#1A1A1A] transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={handleLogout}
            type="button"
          >
            {loading ? t("layout.loggingOut") : t("layout.logout")}
          </button>
          {logoutError ? <p className="px-3 py-2 text-xs font-bold text-[#DC2626]">{logoutError}</p> : null}
        </div>
      ) : null}
    </div>
  );
});
