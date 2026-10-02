# Email workspace

The shared hotel mailbox lives at `/{locale}/email` and is available to administrators, accountants, and front desk staff. Connection settings remain at Settings → Email and require settings permissions. The mailbox identity endpoint exposes only the address and display name to mailbox users.

## Behavior

- Read, compose, reply, reply all, forward, search, and download attachments using the existing mail connection.
- Inbox, Sent, Drafts, Archive, Pinned, and Trash views; pins collect shared IMAP flagged messages from Inbox, Sent, and Archive. Drafts can be saved or trashed.
- Save drafts to the connected mail server, reopen with their attachments, and remove a sent draft only after successful SMTP submission.
- A PostgreSQL transaction advisory lock coordinates existing draft saves, sends, and removal across app processes. A competing request returns a conflict; a missing or replaced draft cannot be sent. No new database tables or migration are required.
- Archive, restore to Inbox, pin/unpin, read/unread, and move to Trash work on individual messages and selections.
- Permanent deletion is available only in Trash and requires confirmation. Missing Trash must produce an error rather than permanently deleting mail.
- Mailbox lists and unread counts refresh periodically while the browser page is visible.

The provider retains messages and attachments. No additional database schema, email hosting service, or mailbox content copy is introduced. Actions affect the shared provider mailbox and are visible to other staff and external mail clients. SMTP success means the server accepted a submission; it does not guarantee delivery to the recipient.

## Validation

Run `node --import tsx --test src/config/email-access.test.ts` for the permission boundary and `node scripts/verify-email-mailbox.mjs` for mocked provider behavior and input validation. Run `node --import tsx --test scripts/email-workspace.browser.test.ts` for actual components in Chromium with local mock mail endpoints, which cannot send or modify real email. Run targeted ESLint and `npm run build` before deploying.

Run `node scripts/verify-email-smtp.mjs` for the actual Nodemailer transport against a temporary localhost SMTP server. It verifies that a stalled send is cancelled by destroying its tracked socket and that the send settles before its draft lock is released. It uses no external mailbox.

Live provider connectivity, provider-specific folder behavior, and actual sending require a separate check with a designated test mailbox. Local mocks do not establish those results. No remote mailbox changes are made during automated checks. SMTP and IMAP cannot share an atomic transaction: an uncertain SMTP timeout requires checking Sent before retrying, and draft cleanup failures produce a warning. Locks coordinate this application's requests, not changes made in external mail clients.

## Boundaries

One shared connected account; no per-staff mailbox connections, assignment workflow, custom labels, or mail hosting. Connection secrets remain encrypted on the server. Message HTML remains isolated in a sandboxed iframe. Mail routes retain authentication, CSRF protection for mutations, rate limiting, and server input validation.

Implementation references: [ImapFlow mailbox operations](https://imapflow.com/docs/api/imapflow-client/) and [Next.js page conventions](https://nextjs.org/docs/app/api-reference/file-conventions/page).
