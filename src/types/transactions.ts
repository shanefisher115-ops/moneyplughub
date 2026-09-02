export type TransactionType =
  | 'charge'
  | 'payout'
  | 'xp_award'
  | 'xp_spend'
  | 'commission'
  | 'refund'
  | 'internal_transfer';

export type TransactionSource =
  | 'stripe'
  | 'xp_purchase'
  | 'commission'
  | 'system'
  | 'crypto'
  | 'manual';

export interface BaseMetadata {
  description?: string;
  client_ip?: string;
  user_agent?: string;
  [key: string]: unknown;
}

export interface StripeMetadata extends BaseMetadata {
  stripe_event_id: string;
  stripe_payment_intent_id?: string;
  stripe_customer_id?: string;
  stripe_checkout_session_id?: string;
  currency: string;
  payment_method_type?: string;
  livemode: boolean;
  receipt_url?: string;
}

export interface XPPurchaseMetadata extends BaseMetadata {
  xp_awarded: number;
  item: string;
  tier?: string;
  bonus_multiplier?: number;
  unlocked_ability_id?: string;
}

export interface CommissionMetadata extends BaseMetadata {
  reason: string;
  referral_user_id?: string;
  campaign_id?: string;
  commission_tier?: string;
  rate_applied?: number;
}

export interface BaseTransactionRecord {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  source: TransactionSource;
  timestamp: string;
  is_real: boolean;
  processor_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface StripeTransaction extends BaseTransactionRecord {
  source: 'stripe';
  is_real: true;
  type: 'charge' | 'refund' | 'payout';
  processor_id: string;
  metadata: StripeMetadata;
}

export interface XPTransaction extends BaseTransactionRecord {
  source: 'xp_purchase';
  is_real: false;
  type: 'xp_award' | 'xp_spend';
  metadata: XPPurchaseMetadata;
}

export interface CommissionTransaction extends BaseTransactionRecord {
  source: 'commission';
  is_real: false;
  type: 'commission';
  metadata: CommissionMetadata;
}

export interface GenericTransaction extends BaseTransactionRecord {
  metadata: BaseMetadata;
}

export type Transaction =
  | StripeTransaction
  | XPTransaction
  | CommissionTransaction
  | GenericTransaction;

export interface CreateTransactionDTO {
  user_id: string;
  amount: number;
  type: TransactionType;
  source: TransactionSource;
  timestamp?: string | Date;
  is_real: boolean;
  processor_id?: string | null;
  metadata: Record<string, unknown>;
}
