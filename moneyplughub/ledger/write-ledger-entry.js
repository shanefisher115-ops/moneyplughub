import fs from "fs";
import path from "path";
import crypto from "crypto";

export function writeLedgerEntry({
  environment = "dev",
  generator = "supabase-cli",
  diffFile,
  notes = "",
  promotedFrom = null,
  approved = false
}) {
  const ledgerPath = path.resolve("primordiaos", "moneyplughub", "ledger", "schema-history.json");
  const timestamp = new Date().toISOString();
  const version = timestamp.replace(/[-:TZ.]/g, "").slice(0, 14);

  let hash = "sha256-empty";
  if (diffFile && fs.existsSync(diffFile)) {
    const diffContent = fs.readFileSync(diffFile, "utf8");
    hash = `sha256-${crypto.createHash("sha256").update(diffContent).digest("hex")}`;
  }

  const entry = {
    timestamp,
    version,
    environment,
    generator,
    diff_file: diffFile ? diffFile.replace(/\\/g, "/") : "",
    hash,
    approved,
    promoted_from: promotedFrom,
    notes
  };

  const ledgerDir = path.dirname(ledgerPath);
  if (!fs.existsSync(ledgerDir)) {
    fs.mkdirSync(ledgerDir, { recursive: true });
  }

  let ledger = [];
  if (fs.existsSync(ledgerPath)) {
    try {
      ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    } catch {
      ledger = [];
    }
  }

  ledger.push(entry);
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), "utf8");
  console.log("? PrimordiaOS Ledger updated:", entry);
  return entry;
}
