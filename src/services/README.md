# Services

Server-side data access for the app. All database access goes through Prisma.

## Structure:
```
services/
- db/              # Prisma client, RPC helpers (withActor), row mappers, errors
- auth/            # Session auth (bi_session cookie)
- logs/            # Activity log service
- {service}.ts     # Feature services
```

## Env:
`DATABASE_URL` (pooled; migrations derive the direct URL from it, or use an optional `DIRECT_URL`) — server-only, never expose to the browser.
