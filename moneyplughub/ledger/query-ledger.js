import { readLedger } from "./read-ledger.js";

export function getLatestEntry() {
  const ledger = readLedger();
  return ledger[ledger.length - 1] || null;
}

export function getEntriesByEnvironment(env) {
  const ledger = readLedger();
  return ledger.filter(e => e.environment.toLowerCase() === env.toLowerCase());
}

export function getUnapprovedEntries() {
  const ledger = readLedger();
  return ledger.filter(e => !e.approved);
}

export function getEntryByVersion(version) {
  const ledger = readLedger();
  return ledger.find(e => e.version === version) || null;
}
