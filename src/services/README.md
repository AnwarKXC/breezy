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
`DATABASE_URL` (pooled) and `DIRECT_URL` (migrations) — server-only, never expose to the browser.
