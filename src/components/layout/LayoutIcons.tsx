const iconClass = "h-4 w-4";
const actionIconClass = "h-[18px] w-[18px]";

export function DashboardIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function ContactsIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 11a4 4 0 1 0-8 0" />
      <path d="M4 21a8 8 0 0 1 16 0" />
      <path d="M19 3v4M21 5h-4" />
    </svg>
  );
}

export function ReservationsIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 2v4M16 2v4" />
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

export function AccountingIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M6 7v13h12V7M8 11h8M8 15h3M14 15h2" />
      <path d="M9 4h6l1 3H8Z" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function LogsIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h10M8 12h10M8 18h10" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06-2.97 2.97-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66v.17h-4.2v-.09a1.8 1.8 0 0 0-1.18-1.68 1.8 1.8 0 0 0-1.98.36l-.06.06-2.97-2.97.06-.06a1.8 1.8 0 0 0 .36-1.98 1.8 1.8 0 0 0-1.66-1.1H1.9v-4.2h.09a1.8 1.8 0 0 0 1.68-1.18 1.8 1.8 0 0 0-.36-1.98l-.06-.06 2.97-2.97.06.06a1.8 1.8 0 0 0 1.98.36 1.8 1.8 0 0 0 1.16-1.64V2.1h4.2v.09a1.8 1.8 0 0 0 1.1 1.66 1.8 1.8 0 0 0 1.98-.36l.06-.06 2.97 2.97-.06.06a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.66 1.1h.17v4.2h-.09A1.8 1.8 0 0 0 19.4 15Z" />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 19V5a2 2 0 0 0-2-2h-5" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg className={actionIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg className={actionIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg className={actionIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg className={actionIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
