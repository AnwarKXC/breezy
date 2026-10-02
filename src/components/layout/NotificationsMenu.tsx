"use client";

import { memo, useCallback, useId, useState } from "react";

import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { BellIcon } from "./LayoutIcons";

interface NotificationsMenuProps {
  isRTL: boolean;
  t: (key: string) => string;
}

export const NotificationsMenu = memo(function NotificationsMenu({
  isRTL,
  t,
}: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const dropdownId = useId();
  const closeMenu = useCallback(() => setOpen(false), []);
  const ref = useClickOutside<HTMLDivElement>(closeMenu);

  return (
    <div ref={ref} className="relative">
      <button
        aria-controls={dropdownId}
        aria-expanded={open}
        aria-label={t("layout.notifications")}
        className="relative grid h-10 w-10 place-items-center rounded-xl bg-white text-[#1A1A1A] transition-colors hover:bg-accent-hover hover:text-accent-foreground"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <BellIcon />
        <span
          aria-hidden="true"
          className={`absolute top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#FDEBEC]0 ${
            isRTL ? "left-2" : "right-2"
          }`}
        />
      </button>

      {open ? (
        <div
          className={`absolute top-12 w-72 rounded-xl border border-[#EAEAEA] bg-white p-4 text-sm ${
            isRTL ? "left-0" : "right-0"
          }`}
          id={dropdownId}
          role="status"
        >
          <p className="font-medium text-[#1A1A1A]">{t("layout.notifications")}</p>
          <p className="mt-2 text-[#787774]">{t("layout.noNotifications")}</p>
        </div>
      ) : null}
    </div>
  );
});
