import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends through the Resend HTTP API when RESEND_API_KEY and EMAIL_FROM are set.
 * Without them, development prints the message to the server console.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("email/not_configured");
    console.info(`[email] to=${message.to} subject=${message.subject}\n${message.text}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!response.ok) throw new Error(`email/send_failed:${response.status}`);
}
