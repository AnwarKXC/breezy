import "server-only";

import { fleetConfig } from "@/services/fleet/config";
import { getEmailAccount } from "./account";
import { sendSmtpMessage } from "./smtp";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

async function sendViaResend(message: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!response.ok) throw new Error(`email/send_failed:${response.status}`);
  return true;
}

/** The hotel's own mailbox (Settings > Email), when an admin connected one. */
async function sendViaMailbox(message: EmailMessage): Promise<boolean> {
  const account = await getEmailAccount().catch(() => null);
  if (!account) return false;
  await sendSmtpMessage(account, {
    from: account.displayName ? { name: account.displayName, address: account.email } : account.email,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  return true;
}

/**
 * Sends with the hotel's own email: the Resend API (RESEND_API_KEY + EMAIL_FROM), else the
 * mailbox connected in Settings > Email. Without either, development prints the message.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (await sendViaResend(message)) return;
  if (await sendViaMailbox(message)) return;
  if (process.env.NODE_ENV === "production") throw new Error("email/not_configured");
  console.info(`[email] to=${message.to} subject=${message.subject}\n${message.text}`);
}

/**
 * Password-reset email. Uses the hotel's own email when it has one; otherwise the control
 * plane sends it with its mailbox, so an admin who never set up email is not locked out.
 * The control plane writes that message itself from the link (it must point at this hotel).
 */
export async function sendPasswordResetEmail(input: { to: string; link: string; locale: string; message: EmailMessage }): Promise<void> {
  if (await sendViaResend(input.message)) return;
  if (await sendViaMailbox(input.message)) return;

  const { controlUrl, instanceId, instanceSecret } = fleetConfig();
  if (controlUrl && instanceId && instanceSecret) {
    const response = await fetch(`${controlUrl}/api/relay/password-reset`, {
      method: "POST",
      headers: { Authorization: `Bearer ${instanceSecret}`, "X-Fleet-Instance": instanceId, "Content-Type": "application/json" },
      body: JSON.stringify({ to: input.to, link: input.link, locale: input.locale === "ar" ? "ar" : "en" }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`email/relay_failed:${response.status}`);
    return;
  }

  if (process.env.NODE_ENV === "production") throw new Error("email/not_configured");
  console.info(`[email] to=${input.to} subject=${input.message.subject}\n${input.message.text}`);
}
