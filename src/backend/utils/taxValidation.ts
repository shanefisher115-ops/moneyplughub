import crypto from 'crypto';

export interface TaxValidationResult {
  valid: boolean;
  formatted: string;
  masked: string;
  cleanDigits: string;
  error?: string;
}

// Valid IRS EIN Prefixes
const VALID_EIN_PREFIXES = new Set([
  '01', '02', '03', '04', '05', '06',
  '10', '11', '12', '13', '14', '15', '16',
  '20', '21', '22', '23', '24', '25', '26', '27',
  '30', '31', '32', '33', '34', '35', '36', '37', '38', '39',
  '41', '42', '43', '44', '45', '46', '47', '48',
  '51', '52', '53', '54', '55', '56', '57', '58', '59',
  '60', '61', '62', '63', '64', '65', '66', '67', '68',
  '71', '72', '73', '74', '75', '76', '77',
  '80', '81', '82', '83', '84', '85', '86', '87', '88',
  '90', '91', '92', '93', '94', '95', '98', '99'
]);

/**
 * Validates a Social Security Number (SSN) or Employer Identification Number (EIN).
 */
export function validateTin(tinRaw: string, tinType: 'ssn' | 'ein'): TaxValidationResult {
  if (!tinRaw || typeof tinRaw !== 'string') {
    return { valid: false, formatted: '', masked: '', cleanDigits: '', error: 'TIN/EIN is required.' };
  }

  const cleanDigits = tinRaw.replace(/\D/g, '');

  if (cleanDigits.length !== 9) {
    return {
      valid: false,
      formatted: '',
      masked: '',
      cleanDigits,
      error: `Invalid length for ${tinType.toUpperCase()}. Must contain exactly 9 digits.`
    };
  }

  // Check for repetitive digits (e.g., 000000000, 111111111)
  if (/^(\d)\1{8}$/.test(cleanDigits)) {
    return {
      valid: false,
      formatted: '',
      masked: '',
      cleanDigits,
      error: `Invalid ${tinType.toUpperCase()}. Repetitive dummy number detected.`
    };
  }

  if (tinType === 'ssn') {
    const area = cleanDigits.substring(0, 3);
    const group = cleanDigits.substring(3, 5);
    const serial = cleanDigits.substring(5, 9);

    if (area === '000' || area === '666' || parseInt(area, 10) >= 900) {
      return {
        valid: false,
        formatted: '',
        masked: '',
        cleanDigits,
        error: 'Invalid SSN area code. Area code cannot be 000, 666, or 900+.'
      };
    }

    if (group === '00') {
      return {
        valid: false,
        formatted: '',
        masked: '',
        cleanDigits,
        error: 'Invalid SSN group number. Group number cannot be 00.'
      };
    }

    if (serial === '0000') {
      return {
        valid: false,
        formatted: '',
        masked: '',
        cleanDigits,
        error: 'Invalid SSN serial number. Serial number cannot be 0000.'
      };
    }

    const formatted = `${area}-${group}-${serial}`;
    const masked = `***-**-${serial}`;

    return {
      valid: true,
      formatted,
      masked,
      cleanDigits
    };
  } else {
    // EIN Validation
    const prefix = cleanDigits.substring(0, 2);
    const suffix = cleanDigits.substring(2, 9);

    if (!VALID_EIN_PREFIXES.has(prefix)) {
      return {
        valid: false,
        formatted: '',
        masked: '',
        cleanDigits,
        error: `Invalid EIN prefix '${prefix}'. Must be a recognized IRS campus prefix.`
      };
    }

    if (suffix === '0000000') {
      return {
        valid: false,
        formatted: '',
        masked: '',
        cleanDigits,
        error: 'Invalid EIN serial number. Serial cannot be all zeros.'
      };
    }

    const formatted = `${prefix}-${suffix}`;
    const masked = `**-***${suffix.substring(3)}`;

    return {
      valid: true,
      formatted,
      masked,
      cleanDigits
    };
  }
}

/**
 * Computes SHA-256 hash of tax form fields for non-repudiation audit logging.
 */
export function hashTaxPayload(payload: Record<string, any>): string {
  const jsonStr = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}
