// pnpm hotel:new <name> [--client="Hotel display name"] [--region=aws-eu-central-1]
//                      [--admin-email=owner@hotel.com] [--demo]
//   optional client details:  [--contact-name="..."] [--contact-email=...] [--contact-phone=...] [--country=...]
//   optional subscription:    [--cycle=monthly|quarterly|yearly] [--price=1500] [--currency=EGP] [--start=2026-10-01]
//   (anything left out shows as "details to complete" in the control plane)
//
// Creates a complete, deployed hotel from one name (e.g. hotel12), with no copy/paste
// and no local copy of the hotel: everything lives in Neon, GitHub and Vercel.
//   1. Neon project <name>                          -> pooled DATABASE_URL
//   2. Vercel project <name> + <name>.vercel.app domain
//   3. env + migrate + base seed + admin              (scripts/setup-project.ts, temp file)
//   4. Control plane instance -> FLEET_* env          (needs CONTROL_PLANE_URL/TOKEN in .env)
//   5. Vercel env vars (production)
//   6. Private GitHub repo <owner>/<name>, connected to Vercel
//   7. One fresh commit of this app's working tree (dev tooling left out), built with
//      git plumbing and pushed straight to the repo -> Vercel builds and deploys it
//
// Needs neonctl, gh and vercel installed and logged in. Every name is checked before
// anything is created; if a later step fails, the created resources are listed with
// the command to remove each one. The temp folder (env file, git index) is always deleted.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseEnv, readEnvFile, upsertEnv, writeEnvFile } from "./env-file";

// Dev-only files that a hotel's repo does not need.
const EXCLUDED = [
  ".agents/", ".claude/", ".codex/", ".opencode/", ".playwright-mcp/", "graphify-out/", "specs/", "docs/",
  ".mcp.json", ".graphify_python", ".graphify_incremental.json", "skills-lock.json",
  "AGENTS.md", "CLAUDE.md", "CLAUDE_TRANSLATION.md", "grep.exe.stackdump",
];
const SECRET_KEY = /KEY|SECRET|PASSWORD|TOKEN|DATABASE_URL/;

// --- Arguments ------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const name = args.find((a) => !a.startsWith("--"))?.toLowerCase() ?? "";
const region = flag("region") ?? "aws-eu-central-1";
const clientName = flag("client") ?? name;
const demo = args.includes("--demo");

// Client and subscription details for the control plane; omitted ones are completed in the panel.
const definedOnly = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const clientDetails = definedOnly({
  contact_name: flag("contact-name"),
  contact_email: flag("contact-email"),
  contact_phone: flag("contact-phone"),
  country: flag("country"),
});
const subscription = definedOnly({
  billing_cycle: flag("cycle"),
  price: flag("price") === undefined ? undefined : Number(flag("price")),
  currency: flag("currency")?.toUpperCase(),
  contract_start: flag("start"),
});
const sourceDir = process.cwd();

// Scratch space only: the hotel's env file and a git index. Deleted on exit, success or not.
// Vercel commands run in their own empty subfolder: the CLI leaves a background worker in
// its working directory on Windows, which locks that folder but not the files beside it.
const work = mkdtempSync(join(tmpdir(), "hotel-new-"));
const vercelCwd = join(work, "vercel");
mkdirSync(vercelCwd);
function cleanup() {
  for (const file of ["hotel.env", "index"]) rmSync(join(work, file), { force: true });
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // Only an empty, locked folder can be left behind; the secrets are already gone.
  }
}
const created: { what: string; undo: string }[] = [];

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  cleanup();
  if (created.length) {
    console.error("\nCreated so far (remove with):");
    for (const { what, undo } of created) console.error(`  ${what.padEnd(28)} ${undo}`);
  }
  process.exit(1);
}

function step(title: string) {
  console.log(`\n▶ ${title}`);
}

// neonctl, vercel and pnpm are .cmd shims on Windows and need a shell; git and gh are real executables.
const SHIMS = new Set(["neonctl", "vercel", "pnpm"]);
const quote = (arg: string) => (/[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg);

/**
 * Runs a CLI. Arguments are fixed strings or the validated name, never secrets:
 * secrets travel through `input` (stdin) or the environment.
 */
function sh(command: string, commandArgs: string[], options: { cwd?: string; input?: string; env?: NodeJS.ProcessEnv; quiet?: boolean } = {}) {
  const shell = process.platform === "win32" && SHIMS.has(command);
  const result = spawnSync(command, shell ? commandArgs.map(quote) : commandArgs, {
    cwd: options.cwd ?? sourceDir,
    input: options.input,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell,
    stdio: [options.input === undefined ? "ignore" : "pipe", options.quiet === false ? "inherit" : "pipe", options.quiet === false ? "inherit" : "pipe"],
  });
  return { ok: result.status === 0, out: (result.stdout ?? "").trim(), err: (result.stderr ?? "").trim() };
}

function must(label: string, result: ReturnType<typeof sh>) {
  if (!result.ok) fail(`${label} failed:\n${(result.err || result.out).split("\n").slice(-8).join("\n")}`);
  return result.out;
}

function json<T>(text: string): T {
  // CLIs may print notices before the JSON document.
  const start = Math.min(...["{", "["].map((c) => text.indexOf(c)).filter((i) => i >= 0));
  if (!Number.isFinite(start)) throw new Error(`Expected JSON from the CLI, got: ${text.slice(0, 200) || "(nothing)"}`);
  return JSON.parse(text.slice(start)) as T;
}

// Vercel commands run in the empty scratch folder and name the project explicitly,
// so they can never pick up a `.vercel` link from this repo.
const vercel = (commandArgs: string[], options: { input?: string; quiet?: boolean } = {}) => sh("vercel", commandArgs, { cwd: vercelCwd, ...options });

// Checked before anything is created; the control plane validates the same rules again.
if (subscription.billing_cycle !== undefined && !["monthly", "quarterly", "yearly"].includes(String(subscription.billing_cycle))) {
  fail("--cycle must be monthly, quarterly or yearly");
}
if (subscription.price !== undefined && !(Number(subscription.price) >= 0)) fail("--price must be a number >= 0");
if (subscription.currency !== undefined && !/^[A-Z]{3}$/.test(String(subscription.currency))) fail("--currency must be a 3-letter code, e.g. EGP");
if (subscription.contract_start !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(subscription.contract_start))) fail("--start must be YYYY-MM-DD");
if (clientDetails.contact_email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(clientDetails.contact_email))) fail("--contact-email is not an email address");

if (!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(name)) {
  fail('Usage: pnpm hotel:new <name> [--client="Hotel name"] [--demo]\n  name: 3-50 chars, a-z 0-9 and dashes (e.g. hotel12)');
}

async function main() {
  // --- 0. Preflight: tools, logins and free names -------------------------------------------

  step("Checking tools and names");
  if (!sh("neonctl", ["me", "--output", "json"]).ok) fail("Neon CLI not logged in. Run: neonctl auth");
  const orgs = json<{ id: string }[] | { organizations: { id: string }[] }>(must("neonctl orgs list", sh("neonctl", ["orgs", "list", "--output", "json"])));
  const orgList = Array.isArray(orgs) ? orgs : orgs.organizations;
  const orgId = flag("org") ?? (orgList.length === 1 ? orgList[0].id : undefined);
  if (!orgId) fail(`Several Neon organizations found; pass --org=<id> (${orgList.map((o) => o.id).join(", ")}).`);
  const neonProjects = json<{ name: string }[] | { projects: { name: string }[] }>(
    must("neonctl projects list", sh("neonctl", ["projects", "list", "--org-id", orgId, "--output", "json"])),
  );
  if ((Array.isArray(neonProjects) ? neonProjects : neonProjects.projects).some((p) => p.name === name)) {
    fail(`A Neon project named "${name}" already exists.`);
  }

  const ghUser = sh("gh", ["api", "user", "--jq", ".login"]);
  if (!ghUser.ok) fail("GitHub CLI not logged in. Run: gh auth login");
  const repo = `${ghUser.out}/${name}`;
  if (sh("gh", ["repo", "view", repo]).ok) fail(`GitHub repo ${repo} already exists.`);

  if (!vercel(["whoami"]).ok) fail("Vercel CLI not logged in. Run: vercel login");
  const vercelProjects = json<{ projects: { name: string }[] }>(must("vercel project ls", vercel(["project", "ls", "--format", "json"])));
  if (vercelProjects.projects.some((p) => p.name === name)) fail(`A Vercel project named "${name}" already exists.`);

  const sourceEnv = parseEnv(readEnvFile(join(sourceDir, ".env")));
  const controlUrl = sourceEnv.get("CONTROL_PLANE_URL")?.replace(/\/+$/, "");
  const controlToken = sourceEnv.get("CONTROL_PLANE_TOKEN");
  if (!controlUrl || !controlToken) console.log("  ! CONTROL_PLANE_URL/TOKEN not in .env: the hotel will not be registered in the control plane (unmanaged).");
  if (sh("git", ["status", "--porcelain"]).out) console.log("  ! Uncommitted changes in this repo: the hotel gets your working tree as it is now.");
  console.log(`  ok: neon org ${orgId}, github ${ghUser.out}, vercel`);

  // --- 1. Neon --------------------------------------------------------------------------------

  step(`Creating Neon project "${name}" (${region})`);
  const neon = json<{ project: { id: string } }>(
    must("neonctl projects create", sh("neonctl", ["projects", "create", "--name", name, "--region-id", region, "--org-id", orgId, "--output", "json", "--no-secrets"])),
  );
  const neonProjectId = neon.project.id;
  created.push({ what: `Neon project ${neonProjectId}`, undo: `neonctl projects delete ${neonProjectId}` });
  const databaseUrl = must("neonctl connection-string", sh("neonctl", ["connection-string", "--project-id", neonProjectId, "--pooled"]));
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) fail("Unexpected connection string from neonctl.");
  console.log(`  ${neonProjectId} → ${new URL(databaseUrl).hostname}`);

  // --- 2. Vercel project + domain (the URL is needed before the env file) ----------------------

  step(`Creating Vercel project "${name}"`);
  must("vercel project add", vercel(["project", "add", name]));
  created.push({ what: `Vercel project ${name}`, undo: `vercel project rm ${name}` });
  let appUrl = "";
  for (const domain of [`${name}.vercel.app`, `${name}-hotel.vercel.app`, `${name}-${neonProjectId.split("-").pop()}.vercel.app`]) {
    if (vercel(["domains", "add", domain, name]).ok) {
      appUrl = `https://${domain}`;
      break;
    }
  }
  if (!appUrl) fail(`No free *.vercel.app domain found for "${name}". Add one in the Vercel dashboard and rerun.`);
  console.log(`  ${appUrl}`);

  // --- 3. Env file + database ------------------------------------------------------------------

  step("Writing env, migrating, seeding, creating admin");
  const envPath = join(work, "hotel.env");
  const setupArgs = ["setup:project", `--out=${envPath}`, `--app-url=${appUrl}`];
  if (flag("admin-email")) setupArgs.push(`--admin-email=${flag("admin-email")}`);
  if (demo) setupArgs.push("--demo");
  if (!sh("pnpm", setupArgs, { env: { ...process.env, SETUP_DATABASE_URL: databaseUrl }, quiet: false }).ok) fail("Database setup failed (see above).");

  // --- 4. Control plane --------------------------------------------------------------------------

  if (controlUrl && controlToken) {
    step("Registering the hotel in the control plane");
    const response = await fetch(`${controlUrl}/api/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${controlToken}` },
      body: JSON.stringify({
        slug: name,
        name: clientName,
        base_url: appUrl,
        client_name: clientName,
        vercel_project: name,
        neon_project: neonProjectId,
        client: clientDetails,
        subscription,
      }),
      signal: AbortSignal.timeout(30_000),
    }).catch((error: Error) => fail(`Control plane unreachable at ${controlUrl}: ${error.message}`));
    const body = (await response.json().catch(() => null)) as { data?: { env: Record<string, string> }; error?: string } | null;
    if (!response.ok || !body?.data) fail(`Control plane refused the hotel (HTTP ${response.status}): ${body?.error ?? "no details"}`);
    writeEnvFile(envPath, upsertEnv(readEnvFile(envPath), new Map(Object.entries(body.data.env))));
    created.push({ what: "control plane instance", undo: "archive it on its page in the control plane" });
    console.log(`  instance "${name}" registered`);
  }

  // --- 5. Vercel env ---------------------------------------------------------------------------------

  step("Setting Vercel environment variables (production)");
  const env = parseEnv(readEnvFile(envPath));
  let count = 0;
  for (const [key, value] of env) {
    if (!value) continue;
    must(
      `vercel env add ${key}`,
      vercel(["env", "add", key, "production", "--project", name, "--force", "--yes", SECRET_KEY.test(key) ? "--sensitive" : "--no-sensitive"], { input: value }),
    );
    count++;
  }
  console.log(`  ${count} variables`);

  // --- 6. GitHub repo, connected before the first push so the push deploys -----------------------------

  step(`Creating private GitHub repo ${repo}`);
  must("gh repo create", sh("gh", ["repo", "create", repo, "--private"]));
  created.push({ what: `GitHub repo ${repo}`, undo: `gh repo delete ${repo} --yes` });
  const repoUrl = `https://github.com/${repo}`;
  must("vercel git connect", vercel(["git", "connect", repoUrl, "--project", name, "--yes"]));

  // --- 7. Fresh commit of the working tree, pushed without any checkout ---------------------------------

  step("Pushing the app (fresh history)");
  const files = must("git ls-files", sh("git", ["ls-files", "--cached", "--others", "--exclude-standard"]))
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && !EXCLUDED.some((x) => (x.endsWith("/") ? f.startsWith(x) : f === x)));
  // A private index in the scratch folder: this repo's own index, branches and history are untouched.
  const gitEnv = { ...process.env, GIT_INDEX_FILE: join(work, "index") };
  must("git read-tree", sh("git", ["read-tree", "--empty"], { env: gitEnv }));
  // --remove drops paths deleted from the working tree but still in git's file list.
  must("git update-index", sh("git", ["update-index", "--add", "--remove", "-z", "--stdin"], { env: gitEnv, input: `${files.join("\0")}\0` }));
  const tree = must("git write-tree", sh("git", ["write-tree"], { env: gitEnv }));
  const commit = must("git commit-tree", sh("git", ["commit-tree", tree, "-m", `Initial commit: ${name}`]));
  must("git push", sh("git", ["push", `${repoUrl}.git`, `${commit}:refs/heads/main`]));
  console.log(`  ${files.length} files → ${repoUrl}`);

  // --- 8. Wait for Vercel's build of that push ------------------------------------------------------------

  step("Waiting for Vercel to build and deploy (a few minutes)");
  let deploymentUrl = "";
  for (let i = 0; i < 60 && !deploymentUrl; i++) {
    const list = vercel(["ls", name, "--format", "json"]);
    // Right after the push there may be no deployment, and no JSON, yet.
    try {
      if (list.ok) deploymentUrl = json<{ deployments?: { url: string }[] }>(list.out).deployments?.[0]?.url ?? "";
    } catch {
      deploymentUrl = "";
    }
    if (!deploymentUrl) await new Promise((r) => setTimeout(r, 5000));
  }
  if (!deploymentUrl) fail(`No deployment started on Vercel for ${repoUrl}. Check the Vercel GitHub app has access to the repo.`);
  const inspect = vercel(["inspect", deploymentUrl, "--wait", "--timeout", "20m", "--format", "json"]);
  const state = inspect.ok ? json<{ readyState?: string }>(inspect.out).readyState : undefined;
  if (state !== "READY") fail(`Deployment ${state ?? "failed"}: https://vercel.com/dashboard → ${name} → Deployments`);

  // --- Summary ----------------------------------------------------------------------------------------------

  cleanup();
  console.log(`\n✔ ${name} is live`);
  console.log(`  App      ${appUrl}`);
  console.log(`  Sign in  ${env.get("ADMIN_EMAIL")} / ${env.get("ADMIN_PASSWORD")}   (shown once; change it after first login)`);
  console.log(`  Code     ${repoUrl}  (every push to main deploys)`);
  console.log(`  Neon     ${neonProjectId}`);
  console.log("  Env      only in Vercel (Settings > Environment Variables); nothing was saved on this machine");
  if (!controlUrl) console.log("  Control  not registered (set CONTROL_PLANE_URL and CONTROL_PLANE_TOKEN in .env for next time)");
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
