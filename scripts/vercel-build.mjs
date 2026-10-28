// Used by Vercel (package.json "vercel-build"). Optionally applies migrations and demo content, then builds.
//   MIGRATE_ON_BUILD=1    apply forward-only migrations (Production environment only, never previews)
//   SEED_DEMO_ON_BUILD=1  load fictional demo venues/events/talent (idempotent; refused when APP_ENV=production)
// Migrations and seeding prefer DATABASE_URL_UNPOOLED (direct connection) when the database integration provides it.
import { spawnSync } from "node:child_process";

function run(cmd, args, env = process.env) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const wantsMigrate = process.env.MIGRATE_ON_BUILD === "1";
const wantsSeed = process.env.SEED_DEMO_ON_BUILD === "1";

if (wantsMigrate || wantsSeed) {
  if (!process.env.DATABASE_URL) {
    console.error("MIGRATE_ON_BUILD / SEED_DEMO_ON_BUILD is set but DATABASE_URL is not");
    process.exit(1);
  }
  const dbEnv = { ...process.env, DATABASE_URL: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL };
  run("npx", ["tsx", "scripts/migrate.ts"], dbEnv);
  if (wantsSeed) run("npx", ["tsx", "scripts/seed.ts"], dbEnv);
} else {
  console.log("MIGRATE_ON_BUILD / SEED_DEMO_ON_BUILD not set: skipping database steps");
}
run("npx", ["next", "build"]);
