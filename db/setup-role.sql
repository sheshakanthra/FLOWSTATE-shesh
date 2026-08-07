-- One-time, per-database setup: creates the restricted application role
-- DATABASE_URL should point at. Run once against a fresh Postgres, as
-- whatever role owns (or will own, before the first `pnpm db:migrate`) the
-- tables -- e.g. `psql "$DATABASE_MIGRATION_URL" -f db/setup-role.sql`.
--
-- Why this exists at all: the bootstrap role most local Postgres setups
-- hand you (Docker's POSTGRES_USER, a fresh install's default superuser)
-- bypasses row-level security unconditionally. RLS only does anything if
-- the app connects as a role that is neither a superuser nor the tables'
-- owner -- see the Postgres role split decision in PROGRESS.md.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kiln_app') THEN
    CREATE ROLE kiln_app LOGIN PASSWORD 'kiln_app_dev_password';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO kiln_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kiln_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kiln_app;
