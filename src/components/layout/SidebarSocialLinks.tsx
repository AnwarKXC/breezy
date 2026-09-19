"use client";

import { useTranslation } from "@/i18n/hooks/useTranslation";

function FacebookIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.5 8.4V6.9c0-.7.2-1.1 1.2-1.1h1.4V3.2c-.7-.1-1.5-.2-2.2-.2-2.3 0-3.9 1.4-3.9 4v1.4H8.5v2.9H11V21h3.1v-9.7h2.6l.4-2.9h-3.6Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M17.5 6.8h.01" strokeLinecap="round" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.8 8.9H3.9V20h2.9V8.9ZM5.3 7.5a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM20.1 20h-2.9v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V20h-2.9V8.9h2.8v1.5h.1c.4-.8 1.4-1.8 2.9-1.8 3.1 0 3.7 2.1 3.7 4.8V20Z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  {
    href: "https://www.facebook.com/profile.php?id=61566688088808&rdid=frX8sMzhTALTlMDh&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1ASCkwjJfi%2F#",
    icon: <FacebookIcon />,
    label: "Facebook",
  },
  {
    href: "https://www.instagram.com/stepcreative.eg",
    icon: <InstagramIcon />,
    label: "Instagram",
  },
  {
    href: "https://www.linkedin.com/company/step-solutions-eg",
    icon: <LinkedInIcon />,
    label: "LinkedIn",
  },
] as const;

export function SidebarSocialLinks() {
  const { t } = useTranslation();
  return (
    <div className="px-4 pb-4">
      <p className="text-[10px] uppercase tracking-[0.08em] text-[#787774]">{t("layout.poweredBy")}</p>
      <nav aria-label="Social Media" className="mt-3 flex items-center gap-2">
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={link.label}
            className="grid h-8 w-8 place-items-center rounded-md border border-[#EAEAEA] text-[#787774] transition-colors hover:border-[#333333] hover:bg-[#333333] hover:text-white"
          >
            {link.icon}
          </a>
        ))}
      </nav>
    </div>
  );
}
