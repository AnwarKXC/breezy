"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { canAccessModule } from "@/config/access";
import { PERMISSION_MODULES } from "@/config/permissions";
import { ACTIONS } from "@/config/rbac";
import { useAuth } from "@/modules/auth";
import { useCan, useIsHydrated } from "@/shared/rbac/useCan";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { AccountingIcon, ContactsIcon, LogsIcon, ReservationsIcon } from "./LayoutIcons";

interface QuickAction {
  key: string;
  shortcut: string;
  labelKey: string;
  hintKey: string;
  href: string;
  icon: ReactNode;
}

interface QuickActionsMenuProps {
  isRTL: boolean;
  localePrefix: string;
  t: (key: string) => string;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function QuickActionsMenu({ isRTL, localePrefix, t }: QuickActionsMenuProps) {
  const router = useRouter();
  const { role } = useAuth();
  const hydrated = useIsHydrated();
  const canCreateReservation = useCan(ACTIONS.RESERVATIONS_CREATE);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const can = (module: (typeof PERMISSION_MODULES)[keyof typeof PERMISSION_MODULES]) =>
    hydrated && role ? canAccessModule(role, module) : false;

  const candidates: Array<QuickAction | false> = [
    canCreateReservation && {
      key: "new-reservation",
      shortcut: "N",
      labelKey: "layout.quickActions.newReservation",
      hintKey: "layout.quickActions.newReservationHint",
      href: "/reservations/new",
      icon: <ReservationsIcon />,
    },
    can(PERMISSION_MODULES.RESERVATIONS) && {
      key: "year-view",
      shortcut: "Y",
      labelKey: "layout.quickActions.yearView",
      hintKey: "layout.quickActions.yearViewHint",
      href: "/reservations/year-view",
      icon: <ReservationsIcon />,
    },
    can(PERMISSION_MODULES.CONTACTS) && {
      key: "contacts",
      shortcut: "C",
      labelKey: "layout.quickActions.findContact",
      hintKey: "layout.quickActions.findContactHint",
      href: "/contacts",
      icon: <ContactsIcon />,
    },
    can(PERMISSION_MODULES.ACCOUNTING) && {
      key: "accounting",
      shortcut: "A",
      labelKey: "layout.quickActions.accounting",
      hintKey: "layout.quickActions.accountingHint",
      href: "/accounting",
      icon: <AccountingIcon />,
    },
    can(PERMISSION_MODULES.LOGS) && {
      key: "logs",
      shortcut: "L",
      labelKey: "layout.quickActions.activityLog",
      hintKey: "layout.quickActions.activityLogHint",
      href: "/logs",
      icon: <LogsIcon />,
    },
  ];
  const actions = candidates.filter((action): action is QuickAction => Boolean(action));

  const go = (action: QuickAction) => {
    setOpen(false);
    router.push(`${localePrefix}${action.href}`);
  };

  // Global shortcuts: Ctrl/⌘+K toggles the menu; Alt+letter runs an action directly.
  const shortcutKey = actions.map((action) => `${action.shortcut}:${action.href}`).join("|");
  useEffect(() => {
    const shortcuts = shortcutKey ? shortcutKey.split("|").map((entry) => entry.split(":")) : [];
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      const match = shortcuts.find(([shortcut]) => event.code === `Key${shortcut}`);
      if (match) {
        event.preventDefault();
        setOpen(false);
        router.push(`${localePrefix}${match[1]}`);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [localePrefix, router, shortcutKey]);

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  if (actions.length === 0) return null;

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const index = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (index + step + actions.length) % actions.length;
      itemRefs.current[next]?.focus();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("layout.quickActions.title")}
        data-tooltip={`${t("layout.quickActions.title")} (Ctrl+K)`}
        className="flex h-10 items-center gap-2 rounded-xl bg-[#1A1A1A] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#333333] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A1A]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        <span className="hidden md:inline">{t("layout.quickActions.short")}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("layout.quickActions.title")}
          onKeyDown={onMenuKeyDown}
          className={`absolute top-12 z-40 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#EAEAEA] bg-white p-1.5 text-sm shadow-lg animate-fade-in-fast ${isRTL ? "left-0" : "right-0"}`}
        >
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#787774]">
            {t("layout.quickActions.title")}
          </p>
          {actions.map((action, index) => (
            <button
              key={action.key}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              role="menuitem"
              type="button"
              onClick={() => go(action)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] focus:outline-none"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F5F5F5] text-[#1A1A1A]">
                {action.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-[#1A1A1A]">{t(action.labelKey)}</span>
                <span className="block truncate text-xs text-[#787774]">{t(action.hintKey)}</span>
              </span>
              <kbd className="hidden shrink-0 rounded border border-[#EAEAEA] bg-[#FAFAFA] px-1.5 py-0.5 font-mono text-[10px] text-[#787774] sm:inline" dir="ltr">
                Alt+{action.shortcut}
              </kbd>
            </button>
          ))}
          <p className="border-t border-[#EAEAEA] px-3 pb-1 pt-2 text-[11px] text-[#787774]">
            {t("layout.quickActions.footer")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
