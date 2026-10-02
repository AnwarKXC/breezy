import type { ReactNode } from 'react'

export type EmailIconName = 'inbox' | 'sent' | 'draft' | 'archive' | 'pin' | 'trash' | 'search' | 'refresh' | 'compose' | 'chevronLeft' | 'chevronRight' | 'reply' | 'replyAll' | 'forward' | 'attachment' | 'close' | 'check' | 'mail' | 'settings' | 'more' | 'download' | 'read' | 'unread' | 'restore' | 'arrowUpRight'

const paths: Record<EmailIconName, ReactNode> = {
  inbox: <><path d="m4 4-2 9v6a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-6l-2-9H4Z" /><path d="M2 13h6l2 3h4l2-3h6" /></>,
  sent: <><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="m11 13 11-11" /></>,
  draft: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  archive: <><rect x="3" y="3" width="18" height="4" rx="1" /><path d="M5 7v13h14V7M10 11h4" /></>,
  pin: <><path d="m8 3 8 0-1 6 4 4v2H5v-2l4-4-1-6Z" /><path d="M12 15v7" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  refresh: <><path d="M20 7a9 9 0 0 0-15-2L2 8M2 3v5h5M4 17a9 9 0 0 0 15 2l3-3M22 21v-5h-5" /></>,
  compose: <><path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7" /><path d="m15 3 6 6M9 15l-1 4 4-1L22 8a2.1 2.1 0 0 0-6-6L9 15Z" /></>,
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  reply: <><path d="m9 5-7 6 7 6M2 11h11a8 8 0 0 1 8 8" /></>,
  replyAll: <><path d="m7 5-5 6 5 6M13 5l-5 6 5 6M8 11h6a7 7 0 0 1 7 7" /></>,
  forward: <><path d="m15 5 7 6-7 6M22 11H11a8 8 0 0 0-8 8" /></>,
  attachment: <path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9a7 7 0 0 1 10 10l-9 9" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path d="m10 2-1 3-3 1-3-1-2 4 2 2v3l-2 2 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-2-2v-3l2-2-2-4-3 1-3-1-1-3h-4Z" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" /></>,
  read: <><path d="m3 10 9-7 9 7v10H3V10Z" /><path d="m3 10 9 6 9-6" /></>,
  unread: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /><circle cx="20" cy="5" r="3" fill="currentColor" stroke="none" /></>,
  restore: <><path d="M3 9a9 9 0 1 1-1 8M3 3v6h6M12 7v6l4 2" /></>,
  arrowUpRight: <path d="M7 17 17 7M7 7h10v10" />,
}

export function EmailIcon({ name, className = 'h-4 w-4' }: { name: EmailIconName; className?: string }) {
  return <svg aria-hidden="true" className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
