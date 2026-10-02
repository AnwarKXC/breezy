// pnpm fleet:env [path | -] [--file=.env]
//
// Merges the env block copied from the control plane (instance page > Environment
// variables > Copy) into this hotel's .env. Reads the system clipboard by default,
// or the given file ("-" = stdin). Only FLEET_* keys are accepted, so a wrong paste
// can never overwrite DATABASE_URL or other settings.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { parseEnv, readEnvFile, upsertEnv, writeEnvFile } from "./env-file";

const args = process.argv.slice(2);
const target = args.find((a) => a.startsWith("--file="))?.slice("--file=".length) ?? ".env";
const source = args.find((a) => !a.startsWith("--"));

function readClipboard(): string {
  const [command, ...commandArgs] =
    process.platform === "win32"
      ? ["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"]
      : process.platform === "darwin"
        ? ["pbpaste"]
        : ["xclip", "-selection", "clipboard", "-o"];
  return execFileSync(command, commandArgs, { encoding: "utf8" });
}

// stdin only on an explicit "-": some terminals keep a never-closing stdin pipe open.
const input = source === "-" ? readFileSync(0, "utf8") : source ? readFileSync(source, "utf8") : readClipboard();

const block = parseEnv(input);
const updates = new Map([...block].filter(([key, value]) => key.startsWith("FLEET_") && value));
const ignored = [...block.keys()].filter((key) => !updates.has(key));

if (!updates.has("FLEET_INSTANCE_ID") || !updates.has("FLEET_INSTANCE_SECRET")) {
  console.error("No fleet env block found. In the control plane, open the instance > Environment variables > Copy, then run this again.");
  process.exit(1);
}

writeEnvFile(target, upsertEnv(readEnvFile(target, ".env.example"), updates));
console.log(`${target} updated for instance "${updates.get("FLEET_INSTANCE_ID")}".`);
for (const key of updates.keys()) console.log(`  set       ${key}`);
for (const key of ignored) console.log(`  ignored   ${key} (only FLEET_* keys are merged)`);
