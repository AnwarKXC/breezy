// pnpm setup:project "<DATABASE_URL>" [--out=.env] [--app-url=https://hotel.example.com]
//                                      [--admin-email=owner@hotel.com] [--demo]
//
// One command from a database URL to a launch-ready project:
//   1. Writes a complete env file (from .env.example), creating it if missing and
//      backing up the old one if it changes.
//   2. Migrates the database, seeds the base data and creates the admin account.
//   3. With --demo, also loads fake hotel data (dev/demo databases only).
//
// Values come from the current .env by rule:
//   kept       your own accounts/settings shared by every install (AI key, email sender, admin email)
//   new        per-database secrets, regenerated when the database URL changes
//   cleared    per-instance settings that must not leak into another hotel (fleet, URL)
// Rerunning with the same database URL keeps every value (safe to repeat).
// Use --out=.env.hotel-name to prepare another hotel without touching your .env.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

import pg from "pg";

import { parseEnv, readEnvFile, upsertEnv, writeEnvFile } from "./env-file";

const KEPT = [
  "CHATBOT_KEY",
  "CHATBOT_MODEL",
  "CHATBOT_MODEL_CALLBACK",
  "AI_GEMINI_TIER",
  "AI_DAILY_TOKEN_LIMIT",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "ADMIN_EMAIL",
];
const random = (bytes: number) => randomBytes(bytes).toString("base64url");
const NEW_PER_DATABASE: Record<string, () => string> = {
  // Encrypts the mailbox password stored in this database.
  EMAIL_ENCRYPTION_KEY: () => random(32),
  ADMIN_PASSWORD: () => random(15),
};
const CLEARED = [
  "APP_URL",
  "ALLOWED_ORIGINS",
  "APP_VERSION",
  "FLEET_INSTANCE_ID",
  "FLEET_INSTANCE_SECRET",
  "FLEET_LICENSE_PUBLIC_KEY",
  "FLEET_LICENSE_KEY",
];
// Never written: DIRECT_URL is derived from DATABASE_URL by prisma.config.ts; the control-plane
// credentials belong to your machine only (used by hotel:new), never to a hotel.
const DROPPED = ["DIRECT_URL", "CONTROL_PLANE_URL", "CONTROL_PLANE_TOKEN"];

// --- Arguments ------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
// SETUP_DATABASE_URL lets other scripts (hotel:new) pass the URL without putting it on a command line.
const databaseUrl = args.find((a) => !a.startsWith("--")) ?? process.env.SETUP_DATABASE_URL;
const out = flag("out") ?? ".env";
const demo = args.includes("--demo");

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

if (!databaseUrl) fail('Usage: pnpm setup:project "postgresql://user:pass@host/db?sslmode=require" [--demo]');
try {
  if (!/^postgres(ql)?:$/.test(new URL(databaseUrl).protocol)) throw new Error();
} catch {
  fail("The first argument must be a postgresql:// connection string (quote it in the shell).");
}
const appUrl = flag("app-url");
if (appUrl && !/^https?:\/\//.test(appUrl)) fail("--app-url must start with https://");

// --- Preflight ------------------------------------------------------------------

// Catch an unusable server before migrating: Arabic text in migrations and data
// needs UTF8, and the AI read-only role needs PostgreSQL 16+ grant options.
async function preflight(databaseUrl: string) {
  console.log("\n▶ Checking database");
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
    const { rows } = await client.query<{ version: number; encoding: string; tables: string }>(
      `SELECT current_setting('server_version_num')::int AS version,
              pg_encoding_to_char(encoding) AS encoding,
              (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS tables
       FROM pg_database WHERE datname = current_database()`,
    );
    const { version, encoding, tables } = rows[0];
    if (encoding !== "UTF8") fail(`Database encoding is ${encoding}; it must be UTF8 (CREATE DATABASE ... ENCODING 'UTF8' TEMPLATE template0).`);
    if (version < 160000) fail(`PostgreSQL ${Math.floor(version / 10000)} found; 16 or newer is required.`);
    console.log(`  PostgreSQL ${Math.floor(version / 10000)}, UTF8, ${tables === "0" ? "empty" : `${tables} existing tables (pending migrations only)`}`);
  } catch (error) {
    // Connection refusals arrive as an AggregateError (one per resolved address) with an empty message.
    const causes = error instanceof AggregateError ? error.errors : [error];
    const detail = causes.map((e) => (e instanceof Error ? e.message || (e as { code?: string }).code : String(e))).join("; ");
    fail(`Cannot connect to the database: ${detail || "unknown error"}`);
  } finally {
    await client.end().catch(() => {});
  }
}

function main(databaseUrl: string) {
  // --- 1. Env file ------------------------------------------------------------------

  // The current settings come from the target file, or from .env when preparing another file.
  const current = parseEnv(readEnvFile(existsSync(out) ? out : ".env"));
  const sameDatabase = current.get("DATABASE_URL") === databaseUrl;
  const template = readEnvFile(".env.example");
  if (!template) fail(".env.example not found. Run this from the project root.");

  const values = new Map<string, string>();
  const report: [string, string][] = [];

  for (const [key, fallback] of parseEnv(template)) {
    const existing = current.get(key) ?? "";
    if (key === "DATABASE_URL") {
      values.set(key, databaseUrl);
      report.push([key, sameDatabase ? "kept" : "new"]);
    } else if (sameDatabase && existing) {
      values.set(key, existing);
      report.push([key, "kept"]);
    } else if (KEPT.includes(key)) {
      values.set(key, existing || fallback);
      report.push([key, existing ? "kept" : fallback ? "default" : "empty"]);
    } else if (key in NEW_PER_DATABASE) {
      values.set(key, NEW_PER_DATABASE[key]());
      report.push([key, "generated"]);
    } else if (CLEARED.includes(key)) {
      values.set(key, "");
      if (existing) report.push([key, "cleared"]);
    } else {
      values.set(key, existing || fallback);
    }
  }
  if (appUrl) {
    values.set("APP_URL", appUrl);
    values.set("ALLOWED_ORIGINS", new URL(appUrl).origin);
  }
  const adminEmail = flag("admin-email");
  if (adminEmail) values.set("ADMIN_EMAIL", adminEmail.trim().toLowerCase());
  if (demo) values.set("AI_SEEDED_DATA_ONLY", "true");
  if (!values.get("ADMIN_EMAIL")) fail("No admin email: pass --admin-email=you@example.com (or set ADMIN_EMAIL in .env).");

  // Keys that only exist in the current file (custom settings) are carried over.
  for (const [key, value] of current) {
    if (!values.has(key) && !DROPPED.includes(key)) values.set(key, value);
  }

  const next = upsertEnv(template, values);
  if (existsSync(out) && readEnvFile(out) !== next) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    copyFileSync(out, `${out}.backup-${stamp}`);
    console.log(`Backed up ${out} to ${out}.backup-${stamp}`);
  }
  writeEnvFile(out, next);

  console.log(`\n${out} written (${sameDatabase ? "same database: values kept" : "new database"}):`);
  for (const [key, status] of report) if (status !== "kept" || !sameDatabase) console.log(`  ${status.padEnd(9)} ${key}`);

  // --- 2. Database ----------------------------------------------------------------------

  // Child processes get exactly this file's values. Every key of the current .env is set
  // (empty when unused) so dotenv inside the scripts can never fall back to another database.
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const key of [...parseEnv(readEnvFile(".env")).keys(), ...DROPPED]) childEnv[key] = "";
  for (const [key, value] of values) childEnv[key] = value;

  function run(label: string, command: string[]) {
    console.log(`\n▶ ${label}`);
    // Fixed commands only; the database URL travels in the environment, never the shell.
    const result = spawnSync("pnpm", command, { stdio: "inherit", env: childEnv, shell: process.platform === "win32" });
    if (result.status !== 0) fail(`${label} failed. Fix the error above and rerun the same command; every step is safe to repeat.`);
  }

  run("Migrating database", ["exec", "prisma", "migrate", "deploy"]);
  run("Seeding base data", ["db:seed"]);
  run("Creating admin account", ["admin:create"]);
  if (demo) run("Loading demo data", ["db:seed:demo", "--", "--confirm-dev-database"]);

  // --- 3. Summary -----------------------------------------------------------------------

  console.log(`\n✔ Project ready on ${new URL(databaseUrl).hostname}`);
  // hotel:new (which passes SETUP_DATABASE_URL) prints the sign-in and does the fleet and Vercel steps itself.
  if (process.env.SETUP_DATABASE_URL) return;
  console.log(`  Sign in: ${values.get("ADMIN_EMAIL")} / ${values.get("ADMIN_PASSWORD")}   (stored in ${out}; change it after first login)`);
  console.log("\nNext:");
  if (!values.get("APP_URL")) console.log("  - Set APP_URL (or rerun with --app-url=https://...) for password-reset links");
  console.log("  - Fleet: in the control plane, copy the instance env block, then run `pnpm fleet:env" + (out === ".env" ? "" : ` --file=${out}`) + "`");
  console.log(`  - Vercel: paste ${out} into Settings > Environment Variables`);
}

// Preflight before touching any file, so a bad URL never changes .env.
preflight(databaseUrl).then(() => main(databaseUrl));
