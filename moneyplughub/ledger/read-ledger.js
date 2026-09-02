import fs from "fs";
import path from "path";

export function readLedger() {
  const ledgerPath = path.resolve("primordiaos", "moneyplughub", "ledger", "schema-history.json");
  if (!fs.existsSync(ledgerPath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  } catch (err) {
    console.error("Failed to parse schema ledger:", err);
    return [];
  }
}
