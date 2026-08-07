import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * One postgres.js connection pool per process, cached on `globalThis` so
 * Next.js dev's module-reload-on-save doesn't open a new pool (and exhaust
 * Postgres's connection limit) on every edit.
 */
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

export const client = globalForDb.pgClient ?? postgres(databaseUrl, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
