// src/services/README.md
# Services

External API services and Supabase configuration.

## Structure:
```
services/
- supabase/        # Supabase browser, server, and service-role helpers
- api.ts            # API client
- {service}.ts      # Feature services
```

## Supabase env:
Browser/server SSR clients use `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
`NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported as a migration fallback.
Service-role operations must use `SUPABASE_SERVICE_ROLE_KEY` from server-only files only.
