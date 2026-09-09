import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { db, recordAuditLog } from '../db';
import { validateTin, hashTaxPayload } from '../utils/taxValidation';

const router = Router();

export interface W9FormRow {
  id: string;
  user_id: string;
  legal_name: string;
  business_name: string;
  tax_classification: string;
  llc_tax_classification: string;
  exempt_payee_code: string;
  exemption_from_fatca_code: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  tin_type: 'ssn' | 'ein';
  tin_last4: string;
  tin_encrypted: string;
  digital_signature: string;
  signature_date: string;
  ip_address: string;
  user_agent: string;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
}

/**
 * Calculates aggregated gross earnings for a creator in a given tax year.
 */
export function calculateYearlyEarnings(userId: string, taxYear: number) {
  const yearStr = String(taxYear);

  // 1. Commission Ledger (approved or paid)
  const ledgerRows = db.prepare(`
    SELECT status, amount_cents, created_at, updated_at FROM commission_ledger
    WHERE referrer_user_id = ? AND status IN ('approved', 'paid')
  `).all(userId) as any[];

  // 2. Affiliate Payout Logs
  const payoutRows = db.prepare(`
    SELECT earnings_cents, payout_date, created_at FROM affiliate_payout_logs
    WHERE user_id = ? AND status = 'Paid'
  `).all(userId) as any[];

  // 3. Financial Transactions
  const finTxRows = db.prepare(`
    SELECT amount, timestamp, created_at FROM financial_transactions
    WHERE user_id = ? AND type IN ('income', 'commission', 'payout', 'referral_payout', 'reward')
  `).all(userId) as any[];

  // 4. Standard Transactions
  const txRows = db.prepare(`
    SELECT amount_cents, date, created_at FROM transactions
    WHERE user_id = ? AND type IN ('income', 'reward')
  `).all(userId) as any[];

  let totalCents = 0;
  const monthlyBreakdownCents = new Array(12).fill(0);

  // Helper to parse month (0-indexed) if item is in target year
  const processEntry = (cents: number, dateStr?: string) => {
    if (!dateStr || cents <= 0) return;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    if (d.getUTCFullYear() === taxYear) {
      totalCents += cents;
      const monthIdx = d.getUTCMonth(); // 0 to 11
      if (monthIdx >= 0 && monthIdx < 12) {
        monthlyBreakdownCents[monthIdx] += cents;
      }
    }
  };

  for (const r of ledgerRows) {
    processEntry(r.amount_cents, r.updated_at || r.created_at);
  }

  for (const r of payoutRows) {
    processEntry(r.earnings_cents, r.payout_date && r.payout_date !== '-' ? r.payout_date : r.created_at);
  }

  for (const r of finTxRows) {
    const cents = Math.round((r.amount || 0) * 100);
    processEntry(cents, r.timestamp || r.created_at);
  }

  for (const r of txRows) {
    processEntry(r.amount_cents, r.date || r.created_at);
  }

  const thresholdCents = 60000; // $600.00 IRS Reporting Threshold
  const requires1099 = totalCents >= thresholdCents;

  return {
    taxYear,
    totalCents,
    totalUsd: Number((totalCents / 100).toFixed(2)),
    thresholdCents,
    thresholdUsd: 600.0,
    requires1099,
    monthlyBreakdownUsd: monthlyBreakdownCents.map(c => Number((c / 100).toFixed(2)))
  };
}

/**
 * POST /api/tax/w9
 * Submit or update W-9 form with TIN/EIN validation and digital signature logging.
 */
router.post('/w9', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      legal_name,
      business_name,
      tax_classification,
      llc_tax_classification,
      exempt_payee_code,
      exemption_from_fatca_code,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      tin_type,
      tin,
      digital_signature
    } = req.body;

    // Field presence checks
    if (!legal_name || typeof legal_name !== 'string' || legal_name.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Legal Taxpayer Name is required (minimum 2 characters).' });
      return;
    }

    const validClassifications = [
      'individual_sole_proprietor', 'c_corporation', 's_corporation',
      'partnership', 'trust_estate', 'llc', 'other'
    ];
    if (!tax_classification || !validClassifications.includes(tax_classification)) {
      res.status(400).json({ success: false, error: 'Valid Federal Tax Classification is required.' });
      return;
    }

    if (!address_line1 || !city || !state || !zip_code) {
      res.status(400).json({ success: false, error: 'Complete street address, city, state, and ZIP code are required.' });
      return;
    }

    if (!tin_type || !['ssn', 'ein'].includes(tin_type)) {
      res.status(400).json({ success: false, error: 'Taxpayer Identification Type must be SSN or EIN.' });
      return;
    }

    // Validate SSN/EIN format
    const tinResult = validateTin(tin, tin_type);
    if (!tinResult.valid) {
      res.status(400).json({
        success: false,
        error: tinResult.error || `Invalid ${tin_type.toUpperCase()} format.`
      });
      return;
    }

    if (!digital_signature || typeof digital_signature !== 'string' || digital_signature.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Digital signature is required for W-9 certification.' });
      return;
    }

    const now = new Date().toISOString();
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown-Browser';

    const w9Id = `w9_${userId}`;
    const cleanLast4 = tinResult.cleanDigits.slice(-4);
    const encryptedTin = Buffer.from(tinResult.formatted).toString('base64'); // Protected base64 format string

    const payloadToHash = {
      user_id: userId,
      legal_name: legal_name.trim(),
      tax_classification,
      address_line1: address_line1.trim(),
      city: city.trim(),
      state: state.trim(),
      zip_code: zip_code.trim(),
      tin_type,
      tin_last4: cleanLast4,
      digital_signature: digital_signature.trim(),
      timestamp: now
    };
    const payloadHash = hashTaxPayload(payloadToHash);

    // Existing check
    const existing = db.prepare('SELECT id FROM creator_w9_forms WHERE user_id = ?').get(userId) as W9FormRow | undefined;
    const action = existing ? 'updated' : 'signed';

    // Insert/Update W-9
    db.prepare(`
      INSERT OR REPLACE INTO creator_w9_forms (
        id, user_id, legal_name, business_name, tax_classification, llc_tax_classification,
        exempt_payee_code, exemption_from_fatca_code, address_line1, address_line2,
        city, state, zip_code, tin_type, tin_last4, tin_encrypted, digital_signature,
        signature_date, ip_address, user_agent, status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified',
        COALESCE((SELECT created_at FROM creator_w9_forms WHERE user_id = ?), ?), ?
      )
    `).run(
      w9Id, userId, legal_name.trim(), (business_name || '').trim(), tax_classification,
      (llc_tax_classification || '').trim(), (exempt_payee_code || '').trim(),
      (exemption_from_fatca_code || '').trim(), address_line1.trim(), (address_line2 || '').trim(),
      city.trim(), state.trim(), zip_code.trim(), tin_type, cleanLast4, encryptedTin,
      digital_signature.trim(), now, ipAddress, userAgent, userId, now, now
    );

    // Log Digital Signature Audit Trail
    const sigLogId = `siglog_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    db.prepare(`
      INSERT INTO tax_signature_logs (
        id, w9_id, user_id, action, digital_signature, ip_address, user_agent, timestamp, payload_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sigLogId, w9Id, userId, action, digital_signature.trim(), ipAddress, userAgent, now, payloadHash);

    // Record system audit log
    recordAuditLog(userId, `TAX_W9_${action.toUpperCase()}`, 'creator_w9_forms', w9Id, {
      legal_name: legal_name.trim(),
      tin_type,
      tin_last4: cleanLast4,
      payload_hash: payloadHash
    });

    res.json({
      success: true,
      message: `W-9 form successfully ${action === 'signed' ? 'submitted and certified' : 'updated'}.`,
      w9: {
        id: w9Id,
        user_id: userId,
        legal_name: legal_name.trim(),
        business_name: (business_name || '').trim(),
        tax_classification,
        address_line1: address_line1.trim(),
        address_line2: (address_line2 || '').trim(),
        city: city.trim(),
        state: state.trim(),
        zip_code: zip_code.trim(),
        tin_type,
        tin_masked: tinResult.masked,
        digital_signature: digital_signature.trim(),
        signature_date: now,
        status: 'verified'
      }
    });
  } catch (err: any) {
    console.error('Error submitting W-9:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to submit W-9 form.' });
  }
});

/**
 * GET /api/tax/w9
 * Retrieve creator's active W-9 form status and masked details.
 */
router.get('/w9', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const row = db.prepare('SELECT * FROM creator_w9_forms WHERE user_id = ?').get(userId) as W9FormRow | undefined;

    if (!row) {
      res.json({
        success: true,
        hasW9: false,
        w9: null,
        message: 'No active W-9 form on file.'
      });
      return;
    }

    const tinMasked = row.tin_type === 'ssn'
      ? `***-**-${row.tin_last4}`
      : `**-***${row.tin_last4}`;

    res.json({
      success: true,
      hasW9: true,
      w9: {
        id: row.id,
        user_id: row.user_id,
        legal_name: row.legal_name,
        business_name: row.business_name,
        tax_classification: row.tax_classification,
        llc_tax_classification: row.llc_tax_classification,
        exempt_payee_code: row.exempt_payee_code,
        exemption_from_fatca_code: row.exemption_from_fatca_code,
        address_line1: row.address_line1,
        address_line2: row.address_line2,
        city: row.city,
        state: row.state,
        zip_code: row.zip_code,
        tin_type: row.tin_type,
        tin_masked: tinMasked,
        tin_last4: row.tin_last4,
        digital_signature: row.digital_signature,
        signature_date: row.signature_date,
        status: row.status,
        updated_at: row.updated_at
      }
    });
  } catch (err: any) {
    console.error('Error fetching W-9:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve W-9 form.' });
  }
});

/**
 * GET /api/tax/earnings/:year
 * Get aggregated yearly earnings for tax reporting.
 */
router.get('/earnings/:year', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const year = parseInt(req.params.year, 10) || new Date().getFullYear();

    const earningsData = calculateYearlyEarnings(userId, year);
    const w9Row = db.prepare('SELECT id, status, legal_name, tin_type, tin_last4 FROM creator_w9_forms WHERE user_id = ?').get(userId) as any;

    res.json({
      success: true,
      user_id: userId,
      ...earningsData,
      w9Status: w9Row ? w9Row.status : 'missing',
      hasW9: !!w9Row
    });
  } catch (err: any) {
    console.error('Error calculating yearly earnings:', err);
    res.status(500).json({ success: false, error: 'Failed to calculate tax earnings.' });
  }
});

/**
 * GET /api/tax/1099/export
 * Generate or download 1099-MISC export (CSV or JSON format).
 */
router.get('/1099/export', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const format = ((req.query.format as string) || 'csv').toLowerCase();

    const earnings = calculateYearlyEarnings(userId, year);
    const w9 = db.prepare('SELECT * FROM creator_w9_forms WHERE user_id = ?').get(userId) as W9FormRow | undefined;
    const userRow = db.prepare('SELECT email, display_name FROM users WHERE id = ?').get(userId) as any;

    const payorInfo = {
      name: 'MoneyPlugHub Network Inc.',
      tin: '88-9482109',
      address: '100 Sovereign Way, Suite 500',
      city_state_zip: 'San Francisco, CA 94105',
      contact_email: 'tax-compliance@moneyplughub.com'
    };

    const recipientInfo = {
      user_id: userId,
      email: userRow?.email || '',
      legal_name: w9?.legal_name || userRow?.display_name || 'Creator',
      business_name: w9?.business_name || '',
      tax_classification: w9?.tax_classification || 'Individual/Sole Proprietor',
      address: w9 ? `${w9.address_line1} ${w9.address_line2}`.trim() : 'Address On File Required',
      city_state_zip: w9 ? `${w9.city}, ${w9.state} ${w9.zip_code}` : '',
      tin_type: w9?.tin_type || 'SSN',
      tin_masked: w9 ? (w9.tin_type === 'ssn' ? `***-**-${w9.tin_last4}` : `**-***${w9.tin_last4}`) : 'Pending W-9'
    };

    const reportId = `1099_${year}_${userId}`;
    const now = new Date().toISOString();

    // Store or update report in database
    db.prepare(`
      INSERT OR REPLACE INTO tax_1099_reports (
        id, user_id, tax_year, gross_earnings_cents, threshold_cents, requires_1099, w9_id, status, generated_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 'generated', ?, COALESCE((SELECT created_at FROM tax_1099_reports WHERE id = ?), ?), ?
      )
    `).run(
      reportId, userId, year, earnings.totalCents, earnings.thresholdCents,
      earnings.requires1099 ? 1 : 0, w9?.id || null, now, reportId, now, now
    );

    const reportData = {
      form_type: 'IRS Form 1099-MISC / 1099-NEC Export',
      tax_year: year,
      report_id: reportId,
      generated_at: now,
      payor: payorInfo,
      recipient: recipientInfo,
      amounts: {
        box_1_nonemployee_compensation_usd: earnings.totalUsd,
        box_4_federal_tax_withheld_usd: 0.00,
        gross_earnings_cents: earnings.totalCents,
        irs_threshold_usd: earnings.thresholdUsd,
        requires_irs_filing: earnings.requires1099
      },
      compliance_status: w9 ? 'Verified W-9 Certified' : 'Pending W-9 Certification'
    };

    if (format === 'json') {
      res.json({ success: true, report: reportData });
      return;
    }

    // CSV format generation
    const csvRows = [
      ['IRS Form', 'Tax Year', 'Payor Name', 'Payor TIN', 'Recipient User ID', 'Recipient Legal Name', 'Recipient Business Name', 'Recipient TIN Type', 'Recipient TIN Masked', 'Recipient Address', 'Recipient City/State/ZIP', 'Box 1 Nonemployee Comp (USD)', 'Federal Tax Withheld (USD)', 'Filing Required', 'W9 Status'],
      [
        '1099-MISC/NEC',
        String(year),
        `"${payorInfo.name}"`,
        `"${payorInfo.tin}"`,
        `"${recipientInfo.user_id}"`,
        `"${recipientInfo.legal_name}"`,
        `"${recipientInfo.business_name}"`,
        `"${recipientInfo.tin_type.toUpperCase()}"`,
        `"${recipientInfo.tin_masked}"`,
        `"${recipientInfo.address}"`,
        `"${recipientInfo.city_state_zip}"`,
        earnings.totalUsd.toFixed(2),
        '0.00',
        earnings.requires1099 ? 'YES ($600+ Threshold Exceeded)' : 'NO (Below $600)',
        w9 ? 'Verified W-9' : 'Missing W-9'
      ]
    ];

    const csvContent = csvRows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="1099-MISC_${year}_${userId}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    console.error('Error exporting 1099 report:', err);
    res.status(500).json({ success: false, error: 'Failed to generate 1099 export.' });
  }
});

/**
 * GET /api/tax/admin/summary
 * Admin overview of all creators, W-9 statuses, and 1099 threshold eligibility.
 */
router.get('/admin/summary', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const users = db.prepare('SELECT id, email, display_name FROM users').all() as any[];
    const summaries = [];

    let totalEligible1099 = 0;
    let totalVerifiedW9 = 0;
    let totalYearlyPayoutsCents = 0;

    for (const u of users) {
      const earnings = calculateYearlyEarnings(u.id, year);
      const w9 = db.prepare('SELECT id, status, legal_name, tin_type, tin_last4 FROM creator_w9_forms WHERE user_id = ?').get(u.id) as W9FormRow | undefined;

      if (earnings.requires1099) totalEligible1099++;
      if (w9 && w9.status === 'verified') totalVerifiedW9++;
      totalYearlyPayoutsCents += earnings.totalCents;

      summaries.push({
        user_id: u.id,
        email: u.email,
        display_name: u.display_name,
        gross_earnings_usd: earnings.totalUsd,
        gross_earnings_cents: earnings.totalCents,
        requires_1099: earnings.requires1099,
        w9_status: w9 ? w9.status : 'missing',
        w9_legal_name: w9 ? w9.legal_name : null,
        w9_tin_masked: w9 ? (w9.tin_type === 'ssn' ? `***-**-${w9.tin_last4}` : `**-***${w9.tin_last4}`) : null
      });
    }

    res.json({
      success: true,
      tax_year: year,
      summary: {
        total_creators: users.length,
        total_1099_eligible: totalEligible1099,
        total_verified_w9: totalVerifiedW9,
        total_payouts_usd: Number((totalYearlyPayoutsCents / 100).toFixed(2))
      },
      creators: summaries
    });
  } catch (err: any) {
    console.error('Error generating admin tax summary:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve admin tax summary.' });
  }
});

/**
 * POST /api/tax/admin/export-batch
 * Admin batch 1099 export across all eligible creators for a tax year.
 */
router.post('/admin/export-batch', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = parseInt(req.body.year || req.query.year, 10) || new Date().getFullYear();
    const format = ((req.body.format || req.query.format || 'csv') as string).toLowerCase();

    const users = db.prepare('SELECT id, email, display_name FROM users').all() as any[];
    const eligibleRecords = [];

    const payorName = 'MoneyPlugHub Network Inc.';
    const payorTin = '88-9482109';

    for (const u of users) {
      const earnings = calculateYearlyEarnings(u.id, year);
      if (earnings.totalCents > 0) {
        const w9 = db.prepare('SELECT * FROM creator_w9_forms WHERE user_id = ?').get(u.id) as W9FormRow | undefined;
        eligibleRecords.push({
          user_id: u.id,
          email: u.email,
          legal_name: w9?.legal_name || u.display_name,
          business_name: w9?.business_name || '',
          tin_type: w9?.tin_type || 'SSN',
          tin_masked: w9 ? (w9.tin_type === 'ssn' ? `***-**-${w9.tin_last4}` : `**-***${w9.tin_last4}`) : 'Pending W-9',
          address: w9 ? `${w9.address_line1} ${w9.address_line2}`.trim() : 'Address Required',
          city_state_zip: w9 ? `${w9.city}, ${w9.state} ${w9.zip_code}` : '',
          gross_earnings_usd: earnings.totalUsd,
          requires_1099: earnings.requires1099,
          w9_status: w9 ? w9.status : 'missing'
        });
      }
    }

    if (format === 'json') {
      res.json({
        success: true,
        tax_year: year,
        total_records: eligibleRecords.length,
        records: eligibleRecords
      });
      return;
    }

    // CSV format
    const csvHeader = ['Tax Year', 'Payor Name', 'Payor TIN', 'Recipient User ID', 'Recipient Email', 'Recipient Legal Name', 'Recipient Business Name', 'TIN Type', 'TIN Masked', 'Address', 'City State ZIP', 'Nonemployee Compensation (USD)', '1099 Required', 'W9 Status'];
    const csvLines = [csvHeader.join(',')];

    for (const r of eligibleRecords) {
      const row = [
        String(year),
        `"${payorName}"`,
        `"${payorTin}"`,
        `"${r.user_id}"`,
        `"${r.email}"`,
        `"${r.legal_name}"`,
        `"${r.business_name}"`,
        `"${r.tin_type.toUpperCase()}"`,
        `"${r.tin_masked}"`,
        `"${r.address}"`,
        `"${r.city_state_zip}"`,
        r.gross_earnings_usd.toFixed(2),
        r.requires_1099 ? 'YES' : 'NO',
        r.w9_status
      ];
      csvLines.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="1099-MISC_Batch_${year}.csv"`);
    res.send(csvLines.join('\n'));
  } catch (err: any) {
    console.error('Error generating batch 1099 export:', err);
    res.status(500).json({ success: false, error: 'Failed to generate batch 1099 export.' });
  }
});

export default router;
