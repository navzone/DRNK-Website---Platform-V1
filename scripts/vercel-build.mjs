// Used by Vercel (package.json "vercel-build"). Applies forward-only migrations, then builds.
// Migrations run only when MIGRATE_ON_BUILD=1, so preview deployments never touch a database by accident.
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (process.env.MIGRATE_ON_BUILD === "1") {
  if (!process.env.DATABASE_URL) {
    console.error("MIGRATE_ON_BUILD=1 but DATABASE_URL is not set");
    process.exit(1);
  }
  run("npx", ["tsx", "scripts/migrate.ts"]);
} else {
  console.log("MIGRATE_ON_BUILD is not 1: skipping migrations");
}
run("npx", ["next", "build"]);
