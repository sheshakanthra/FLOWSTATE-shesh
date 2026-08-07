import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Deliberately its own connection, not db/client.ts's — migrations run DDL
// (CREATE TABLE, CREATE POLICY, ALTER TABLE ... FORCE ROW LEVEL SECURITY)
// and need the table-owner role. db/client.ts connects as kiln_app, a
// restricted non-superuser role created specifically so the app's own
// queries stay subject to RLS (see the RLS decision in PROGRESS.md — the
// bootstrap Postgres role Docker creates from POSTGRES_USER is a
// superuser, and superusers bypass row security unconditionally, FORCE or
// not).
const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_MIGRATION_URL (or DATABASE_URL) is not set");

async function main() {
  const migrationClient = postgres(databaseUrl!, { max: 1 });
  await migrate(drizzle(migrationClient), { migrationsFolder: "./db/migrations" });
  await migrationClient.end();
  console.log("Migrations applied.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
