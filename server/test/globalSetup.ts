import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

export default function globalSetup() {
  process.env.DATABASE_URL = "file:./test.db";
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  console.log("[test] Recreating test database...");
  execSync("npx prisma db push --force-reset --skip-generate", { cwd: root, env: process.env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { cwd: root, env: process.env, stdio: "inherit" });
  console.log("[test] Test database seeded.");
}