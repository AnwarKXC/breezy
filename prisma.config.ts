import "dotenv/config";
import { defineConfig } from "prisma/config";

// The app runtime uses the pooled DATABASE_URL. Migrations need a direct connection:
// DIRECT_URL when set, otherwise derived from DATABASE_URL so one URL is enough.
//   Neon:     ep-x-pooler.region.aws.neon.tech      -> ep-x.region.aws.neon.tech
//   Supabase: *.pooler.supabase.com:6543 (transaction) -> :5432 (session)
function migrationUrl(): string {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  if (!process.env.DATABASE_URL) return "";
  const url = new URL(process.env.DATABASE_URL);
  url.hostname = url.hostname.replace("-pooler.", ".");
  if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") url.port = "5432";
  url.searchParams.delete("pgbouncer");
  return url.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx --conditions=react-server prisma/seed/index.ts" },
  datasource: { url: migrationUrl() },
});
