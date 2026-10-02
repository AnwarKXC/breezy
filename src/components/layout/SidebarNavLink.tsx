"use client";

import { memo } from "react";
import Link, { useLinkStatus } from "next/link";

// Immediate feedback while the next route streams in (loading.tsx takes over after).
function PendingIndicator() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="ms-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#787774]" /> : null;
}

interface SidebarNavLinkProps {
  href: string;
  icon: React.ReactNode;
  isActive: boolean;
  label: string;
  onClick?: () => void;
  badge?: React.ReactNode;
}

export const SidebarNavLink = memo(function SidebarNavLink({
  href,
  icon,
  isActive,
  label,
  onClick,
  badge,
}: SidebarNavLinkProps) {
  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`flex h-10 items-center gap-3 rounded-md px-4 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-accent/10 text-accent-ink ring-1 ring-inset ring-accent/20"
          : "text-[#787774] hover:bg-accent/10 hover:text-accent-ink"
      }`}
      href={href}
      onClick={onClick}
    >
      <span className="grid h-5 w-5 place-items-center">{icon}</span>
      <span className="truncate">{label}</span>
      {badge}
      <PendingIndicator />
    </Link>
  );
});
