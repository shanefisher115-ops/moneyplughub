import { CreateTransactionDTO } from '../../types/transactions';

export class TransactionValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'TransactionValidationError';
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_METADATA_BYTES = 32768; // 32KB limit

/**
 * Validates transaction payload against fraud prevention and business rules.
 */
export function validateTransactionPayload(payload: CreateTransactionDTO): void {
  // 1. User ID validation
  if (!payload.user_id || typeof payload.user_id !== 'string') {
    throw new TransactionValidationError('Missing or invalid user_id', 'user_id');
  }
  // Allow system-generated IDs or standard UUIDs
  if (payload.user_id.trim().length === 0) {
    throw new TransactionValidationError('user_id cannot be empty', 'user_id');
  }

  // 2. Amount validation (No negative values, NaN, or non-finite numbers)
  if (typeof payload.amount !== 'number' || Number.isNaN(payload.amount) || !Number.isFinite(payload.amount)) {
    throw new TransactionValidationError('Amount must be a finite numeric value', 'amount');
  }
  if (payload.amount < 0) {
    throw new TransactionValidationError('Negative amounts are rejected by fraud prevention', 'amount');
  }

  // 3. Timestamp validation
  if (!payload.timestamp) {
    throw new TransactionValidationError('Missing transaction timestamp', 'timestamp');
  }
  const dateObj = new Date(payload.timestamp);
  if (Number.isNaN(dateObj.getTime())) {
    throw new TransactionValidationError('Invalid ISO timestamp provided', 'timestamp');
  }
  // Reject timestamps in the future (> 5 minutes ahead) to prevent clock skew spoofing
  const maxFutureTime = Date.now() + 5 * 60 * 1000;
  if (dateObj.getTime() > maxFutureTime) {
    throw new TransactionValidationError('Timestamp cannot be in the future', 'timestamp');
  }

  // 4. Metadata structure validation
  if (!payload.metadata || typeof payload.metadata !== 'object' || Array.isArray(payload.metadata)) {
    throw new TransactionValidationError('Metadata must be a valid JSON object', 'metadata');
  }
  const metadataString = JSON.stringify(payload.metadata);
  if (Buffer.byteLength(metadataString, 'utf8') > MAX_METADATA_BYTES) {
    throw new TransactionValidationError('Metadata exceeds maximum size limit (32KB)', 'metadata');
  }

  // 5. Source vs. is_real Consistency Enforcement
  if (payload.source === 'stripe' && payload.is_real !== true) {
    throw new TransactionValidationError('Stripe transactions must have is_real = true', 'is_real');
  }
  if ((payload.source === 'xp_purchase' || payload.source === 'commission') && payload.is_real !== false) {
    throw new TransactionValidationError('XP and Commission transactions must have is_real = false', 'is_real');
  }
}
