import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local is optional (e.g. CI sets DATABASE_URL directly)
}

// Migrations run DDL (CREATE TABLE, CREATE POLICY) and need the table-owner
// role, not the restricted kiln_app runtime role DATABASE_URL points at —
// see db/client.ts and the RLS decision in PROGRESS.md.
const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_MIGRATION_URL (or DATABASE_URL) is not set");

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});
