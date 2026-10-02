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
```
