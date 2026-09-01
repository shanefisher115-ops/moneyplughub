import { Categorizer } from "../roles/Categorizer.js";
import { Sentinel } from "../roles/Sentinel.js";
import { Forecaster } from "../roles/Forecaster.js";
import { Optimizer } from "../roles/Optimizer.js";

export function analyze({
  transaction = {},
  transactions = [],
  categories = [],
  rules = [],
  goals = [],
  referrals = []
} = {}) {
  return [
    ...Categorizer(transaction, categories, rules),
    ...Sentinel(transaction, transactions),
    ...Forecaster(transactions, goals),
    ...Optimizer(referrals, transactions)
  ];
}
