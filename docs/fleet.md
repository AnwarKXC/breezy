# Fleet management (hotel instance side)

Each hotel runs its own deployment and database. A separate **control plane** manages
them all. This document is the contract between the two.

## Instance environment

| Var | Purpose |
|---|---|
| `FLEET_INSTANCE_ID` | Instance id in the control plane. Must equal the license `sub`. |
| `FLEET_INSTANCE_SECRET` | Bearer secret for `/api/system/*`. Unique per hotel, 32+ random chars. |
| `FLEET_LICENSE_PUBLIC_KEY` | Control plane's Ed25519 public key (SPKI PEM). Empty means unmanaged, with no license checks. |
| `FLEET_LICENSE_KEY` | License token used until the control plane pushes one. |
| `APP_VERSION` | Release tag or sha, set by CI. |

## Endpoints

### `GET /api/system/health`
- No auth: `{ status: "ok" }`, or `503 { status: "degraded" }` when the DB is unreachable. Point uptime monitors here.
- `Authorization: Bearer <FLEET_INSTANCE_SECRET>` returns `{ status, data }` with the instance id, version, uptime,
  DB latency, migration state (applied, failed, latest), usage counts (rooms, active users,
  active reservations, last reservation and login times) and license status.
  It returns counts only, never guest, financial or user records.

### `GET | PUT /api/system/license` (Bearer secret)
- `GET` returns the current license status.
- `PUT { "token": "<jwt>" }` verifies and stores a renewed license. Returns `422 license/invalid_token`
  if the signature, issuer or instance id doesn't match.

## License

An EdDSA JWT signed by the control plane:

```json
{ "iss": "breezy-control", "sub": "<instanceId>", "exp": 1798761600, "plan": "standard", "grace_days": 14 }
```

The token is verified offline with the public key, so a control plane outage never blocks a hotel.

| State | Meaning | Effect |
|---|---|---|
| `unmanaged` | No public key configured | Nothing enforced |
| `active` | Before `exp` | Normal |
| `grace` | Past `exp`, within `grace_days` (default 14) | Warning banner |
| `expired` / `invalid` / `missing` | Past grace, bad token, or no token | Banner, and all API writes return `403 license/read_only` |

Even in read-only mode, users can still sign in, sign out and reset passwords, and control-plane calls still work.
Status is cached per process for 60 seconds.

## Tooling

```sh
pnpm fleet:license keygen                                   # once; keep the private key in the control plane only
FLEET_LICENSE_PRIVATE_KEY="..." pnpm fleet:license issue <instanceId> 365 standard 14
pnpm fleet:env                                              # merge the control plane's copied env block into .env
pnpm setup:project "<db url>" [--out=.env.x] [--demo]       # env file + migrate + seed + admin, from one URL
```

## Creating a hotel: `pnpm hotel:new <name>`

One command creates a complete, deployed hotel. You don't copy or paste anything:

```sh
pnpm hotel:new hotel12 --client="Hotel Twelve Hurghada"
```

The hotel is registered in the control plane directly, through `POST /api/provision` (protected by the control
plane's `PROVISION_TOKEN`). Client and subscription details are optional at this point. Anything you leave out is
flagged as **details to complete** on the control plane's fleet, client and instance pages, where you fill it in later:

```sh
pnpm hotel:new hotel12 --client="Hotel Twelve Hurghada"   --contact-name="Mona Adel" --contact-email=owner@hotel12.com --contact-phone=+20100... --country=Egypt   --cycle=monthly --price=1500 --currency=EGP --start=2026-10-01
```

The billing cycle also sets the license length (monthly 31 days, quarterly 92, yearly 366; 365 when not set), both for
the first license and as the default for every renewal in the panel. A bad flag value stops the command before anything
is created.

| Step | What happens |
|---|---|
| Preflight | Checks that `neonctl`, `gh` and `vercel` are logged in, and that `hotel12` is free on Neon, GitHub and Vercel. Nothing is created until every check passes. |
| Neon | Creates project `hotel12` (default `aws-eu-central-1`, override with `--region=`) and reads its pooled `DATABASE_URL`. |
| Vercel | Creates project `hotel12` and attaches `hotel12.vercel.app` (falls back to a suffixed name if it's taken). |
| Database | Runs `setup:project` into a temporary env file: migrates, seeds the base data and creates the admin (`--demo` adds fake data). |
| Control plane | Registers the instance through `POST /api/provision` and adds its `FLEET_*` keys to that env. |
| Vercel env | Pushes every non-empty value to Vercel (production only; secrets are marked sensitive). |
| GitHub | Creates the private repo `<you>/hotel12` and connects it to Vercel. |
| Code | Builds one commit with no history from your working tree (leaving out dev tooling: `.agents`, `.claude`, `docs`, `specs`, graphify…) using git plumbing and a temporary index, then pushes it to `main`. Vercel builds that push and the script waits until it is live. |

Nothing about the hotel stays on your machine: there is no `../hotel12` folder, your repo's branches, index and history are
untouched, and the temporary env file is deleted at the end (even when a step fails). The hotel's env lives only in
Vercel.

At the end it prints the app URL and the admin sign-in. If a step fails, it lists everything it already created and
the command that removes each one.

**One-time setup on your machine:**
- `npm i -g neonctl vercel`, then `neonctl auth`, `vercel login` and `gh auth login`.
- Deploy the control plane once with `pnpm deploy:vercel` in its repo (`D:/breezy-control`). That command also writes
  `CONTROL_PLANE_URL` and `CONTROL_PLANE_TOKEN` into this repo's `.env`. They stay on your machine and are never copied
  into a hotel. Without them, `hotel:new` creates the hotel unmanaged, with no license checks.
- To delete test hotels with `gh repo delete`, run `gh auth refresh -h github.com -s delete_repo` once.

**Plans:** Vercel's Hobby plan is for non-commercial use only. Hotels you sell must run on a Pro team.

### Updating hotels

Each hotel has its own repo, so a fix in this repo does not reach the hotels on its own. To ship a change to a hotel,
apply it to that hotel's repo (copy the changed files, or `git pull` from this repo as a second remote) and push to
`main`. Vercel then builds and runs the hotel's migrations.

Migrations must stay backward compatible (expand, then contract), because the database is migrated before the new
code goes live.

## Manual setup (without hotel:new)

1. Create a Neon project and copy its pooled connection string (host contains `-pooler`).
2. Run `pnpm setup:project "<pooled url>" --out=.env.hotel-name --app-url=https://hotel.example.com`.
   It keeps your shared settings from `.env` (`CHATBOT_*`/AI, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`), generates
   fresh `EMAIL_ENCRYPTION_KEY`/`ADMIN_PASSWORD`, clears per-hotel values, then migrates, seeds and creates the admin.
   Rerunning with the same URL changes nothing in the file.
3. In the control plane, create the instance, press **Copy** under Environment variables, then run
   `pnpm fleet:env --file=.env.hotel-name`.
4. Create a Vercel project, paste `.env.hotel-name` into Settings > Environment Variables and deploy. The `vercel-build`
   script migrates the database before every build.
