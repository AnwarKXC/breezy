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

### Password-reset email relay

A hotel admin who forgot their password gets the reset link by email, sent through the first of:
1. the hotel's Resend key (`RESEND_API_KEY` + `EMAIL_FROM`),
2. the hotel's own mailbox (Settings → Email), or
3. **the control plane**, which sends it from its own mailbox (`control_app_email*` in the control plane env).
   This covers hotels that never set up email.

The relay is `POST <FLEET_CONTROL_URL>/api/relay/password-reset`, with `Authorization: Bearer <FLEET_INSTANCE_SECRET>`,
`X-Fleet-Instance: <FLEET_INSTANCE_ID>` and the body `{ to, link, locale }`. The control plane writes the email itself
(EN/AR, using the hotel's name). It rejects links that don't start with the hotel's registered URL, allows at most 10
emails per hotel per hour, and logs each send in Activity with the address masked. `FLEET_CONTROL_URL` is part of the
env block every hotel gets.

## License

An EdDSA JWT signed by the control plane:

```json
{ "iss": "breezy-control", "sub": "<instanceId>", "iat": 1790950000, "exp": 1822486000, "plan": "standard",
  "grace_days": 14, "warn_days": 15, "mode": "active", "max_rooms": 40, "max_users": 5 }
```

The token is verified offline with the public key, so a control plane outage never blocks a hotel. The mode and limits
are inside the signed token, so a hotel cannot change its own. Unknown modes are treated as read-only.

| State | Meaning | Effect |
|---|---|---|
| `unmanaged` | No public key configured | Nothing enforced |
| `active` | `mode: active`, before `exp` | Normal. Within `warn_days` of `exp`, a countdown banner shows ("ends in 4 days", hours on the last day) |
| `grace` | `mode: active`, past `exp`, within `grace_days` (default 14) | Warning banner |
| `suspended` | `mode: read_only` (**Pause** in the control plane) | "Paused by your provider" banner; API writes return `403 license/read_only` |
| `locked` | `mode: locked` (**Lock** in the control plane) | Every page redirects to `/[locale]/paused`; every API returns `423 license/locked` |
| `expired` / `invalid` / `missing` | Past grace, bad token, or no token | Banner, and API writes return `403 license/read_only` |

Pause and lock take priority over the expiry date, and **Resume** restores the same term. In read-only states, users
can still sign in, sign out and reset passwords, and control-plane calls (`/api/system/*`) always work.

**Limits:** `max_rooms` counts rooms that aren't deleted, and `max_users` counts active users. Creating one beyond the
limit returns `403` with `code: license/room_limit` or `license/user_limit` and a readable message. The check runs
inside the insert's transaction, under a Postgres advisory lock, so concurrent creates can't overshoot. When a limit is
absent, there is no limit. Lowering a limit never deletes anything.

**Expiry warning:** the control plane sets `warn_days` per instance. The default follows the billing cycle (monthly 5,
quarterly 10, yearly or unset 15) and can be overridden on the instance's License card. Licenses issued before
`warn_days` existed warn 15 days ahead.

The health report includes the license `issuedAt`. The control plane re-delivers the newest license whenever the hotel
reports a different one.

Status is cached per process for 60 seconds, and a pushed license takes effect immediately on the instance that receives it.

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
