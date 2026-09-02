import fs from "fs";
import path from "path";
import { readLedger } from "./read-ledger.js";

export function promoteEntry(version, targetEnv, notes = "") {
  const ledgerPath = path.resolve("primordiaos", "moneyplughub", "ledger", "schema-history.json");
  const ledger = readLedger();
  const entryIndex = ledger.findIndex(e => e.version === version);

  if (entryIndex === -1) {
    throw new Error(`Version ${version} not found in ledger.`);
  }

  const existingEntry = ledger[entryIndex];
  const previousEnv = existingEntry.environment;

  const promotionEntry = {
    ...existingEntry,
    timestamp: new Date().toISOString(),
    environment: targetEnv,
    promoted_from: previousEnv,
    approved: true,
    notes: notes || `Promoted version ${version} from ${previousEnv} to ${targetEnv}`
  };

  ledger.push(promotionEntry);
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), "utf8");
  console.log(`?? Version ${version} promoted from ${previousEnv} to ${targetEnv}`);
  return promotionEntry;
}
