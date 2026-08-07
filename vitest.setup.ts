import "@testing-library/jest-dom/vitest";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local is optional (e.g. CI sets DATABASE_URL directly)
}
