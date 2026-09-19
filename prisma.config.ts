import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations use the session pooler (DIRECT_URL); the app runtime uses DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx --conditions=react-server prisma/seed/index.ts" },
  datasource: { url: process.env.DIRECT_URL ?? "" },
});
