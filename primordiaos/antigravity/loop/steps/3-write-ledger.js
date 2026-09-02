import fs from "fs";
import path from "path";

export async function step3_writeLedger(diffResult) {
  console.log("📘 [Step 3/6] Committing cryptographic ledger entry...");
  const ledgerPath = path.resolve("primordiaos/moneyplughub/ledger/schema-history.json");
  let history = [];
  if (fs.existsSync(ledgerPath)) {
    try {
      history = JSON.parse(fs.readFileSync(ledgerPath, "utf-8"));
    } catch (e) {
      history = [];
    }
  }

  const newEntry = {
    version: new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14) + "_auto_index",
    timestamp: new Date().toISOString(),
    diff_hash: diffResult.diffHash,
    environments: { dev: true, staging: true, production: false },
    applied_by: "AntigravityAutonomousDaemon"
  };

  history.push(newEntry);
  fs.writeFileSync(ledgerPath, JSON.stringify(history, null, 2));
  return newEntry;
}