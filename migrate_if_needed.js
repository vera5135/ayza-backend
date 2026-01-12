import { pool } from "./db.js";

export async function migrateIfNeeded() {
  // minimal check: does users table exist?
  const check = await pool.query(
    "SELECT to_regclass('public.users') as exists"
  );
  const exists = check.rows?.[0]?.exists;
  if (exists) return;

  const { default: run } = await import("./migrate_runner.js");
  await run();
}
