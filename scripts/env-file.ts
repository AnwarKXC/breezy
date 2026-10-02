// Minimal .env editing that keeps comments, blank lines and key order.
// Values are single-line; multi-line keys (PEM) are stored with literal \n.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const LINE_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function unquote(raw: string) {
  const value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value.replace(/\s+#.*$/, "");
}

/** KEY=value pairs from .env-formatted text (comments and junk lines ignored). */
export function parseEnv(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = LINE_RE.exec(line);
    if (match) values.set(match[1], unquote(match[2]));
  }
  return values;
}

/** Sets keys in place where they already appear, appends the rest. */
export function upsertEnv(text: string, updates: Map<string, string>): string {
  const pending = new Map(updates);
  const lines = text.split(/\r?\n/).map((line) => {
    const match = LINE_RE.exec(line);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1])!;
    pending.delete(match[1]);
    return `${match[1]}="${value}"`;
  });
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (pending.size) lines.push("", ...[...pending].map(([key, value]) => `${key}="${value}"`));
  return `${lines.join("\n")}\n`;
}

export function readEnvFile(path: string, fallbackTemplate?: string): string {
  if (existsSync(path)) return readFileSync(path, "utf8");
  return fallbackTemplate && existsSync(fallbackTemplate) ? readFileSync(fallbackTemplate, "utf8") : "";
}

export function writeEnvFile(path: string, text: string) {
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}
