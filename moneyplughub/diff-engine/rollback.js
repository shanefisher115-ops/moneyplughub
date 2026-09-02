import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { readLedger } from "../ledger/read-ledger.js";

export function rollback(version, dbUrl = process.env.DATABASE_URL) {
  const migrationsDir = path.resolve("primordiaos", "moneyplughub", "migrations");
  const diffFile = path.join(migrationsDir, `${version}_diff.sql`);

  if (!fs.existsSync(diffFile)) {
    throw new Error(`Migration artifact not found for version: ${version}`);
  }

  const ledger = readLedger();
  const entry = ledger.find(e => e.version === version);
  console.log(`? Initiating rollback for version [${version}]...`);

  try {
    if (dbUrl) {
      execSync(`psql "${dbUrl}" -f "${diffFile}"`, { stdio: "inherit" });
    } else {
      execSync("npx supabase db reset", { stdio: "inherit" });
    }
    console.log(`? Rollback complete for version: ${version}`);
  } catch (error) {
    console.error(`? Rollback execution failed:`, error.message);
    throw error;
  }
}
