import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

export const taxComplianceRouter = Router();

// TIN/EIN Validation Helper
export function validateTINFormat(tin: string, tinType: 'SSN' | 'EIN'): { valid: boolean; formatted: string; cleanDigits: string; message?: string } {
  const cleanDigits = tin.replace(/\D/g, '');
  if (cleanDigits.length !== 9) {
    return { valid: false, formatted: '', cleanDigits: '', message: `${tinType} must contain exactly 9 numeric digits.` };
  }

  // Check for invalid repetitive numbers (e.g., 000000000, 111111111)
  if (/^(\d)\1{8}$/.test(cleanDigits)) {
    return { valid: false, formatted: '', cleanDigits: '', message: `Invalid ${tinType}: Cannot be all identical digits.` };
  }

  let formatted = cleanDigits;
  if (tinType === 'SSN') {
    formatted = `${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 5)}-${cleanDigits.slice(5)}`;
  } else if (tinType === 'EIN') {
    formatted = `${cleanDigits.slice(0, 2)}-${cleanDigits.slice(2)}`;
  }

  return { valid: true, formatted, cleanDigits };
}

// 1. Submit or Update W-9 Form with Digital Signature
taxComplianceRouter.post('/w9', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      legal_name,
      business_name,
      tax_classification,
      tin_type,
      tin_value,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      signature_name,
      consent_agreed,
    } = req.body;

    if (!legal_name || !tax_classification || !tin_type || !tin_value || !address_line1 || !city || !state || !zip_code || !signature_name) {
      return res.status(400).json({ success: false, error: 'All required W-9 fields must be provided.' });
    }

    if (!['individual', 'c_corp', 's_corp', 'partnership', 'llc', 'other'].includes(tax_classification)) {
      return res.status(400).json({ success: false, error: 'Invalid tax classification.' });
    }

    if (!['SSN', 'EIN'].includes(tin_type)) {
      return res.status(400).json({ success: false, error: 'TIN type must be SSN or EIN.' });
    }

    if (!consent_agreed) {
      return res.status(400).json({ success: false, error: 'Digital signature consent is required.' });
    }

    // Format & Validate TIN/EIN
    const tinCheck = validateTINFormat(tin_value, tin_type);
    if (!tinCheck.valid) {
      return res.status(400).json({ success: false, error: tinCheck.message });
    }

    const tin_last_4 = tinCheck.cleanDigits.slice(5);
    const tin_hash = crypto.createHash('sha256').update(tinCheck.cleanDigits + '_tax_salt_2026').digest('hex');
    const now = new Date().toISOString();
    const w9Id = `w9_${userId}_${Date.now()}`;

    // Check if W-9 already exists for this user
    const existingW9 = db.prepare('SELECT id FROM creator_w9_forms WHERE user_id = ?').get(userId) as any;
    const finalW9Id = existingW9 ? existingW9.id : w9Id;

    if (existingW9) {
      db.prepare(`
        UPDATE creator_w9_forms SET
          legal_name = ?, business_name = ?, tax_classification = ?, tin_type = ?,
          tin_last_4 = ?, tin_hash = ?, address_line1 = ?, address_line2 = ?,
          city = ?, state = ?, zip_code = ?, status = 'submitted', updated_at = ?
        WHERE user_id = ?
      `).run(
        legal_name,
        business_name || null,
        tax_classification,
        tin_type,
        tin_last_4,
        tin_hash,
        address_line1,
        address_line2 || null,
        city,
        state,
        zip_code,
        now,
        userId
      );
    } else {
      db.prepare(`
        INSERT INTO creator_w9_forms (
          id, user_id, legal_name, business_name, tax_classification, tin_type,
          tin_last_4, tin_hash, address_line1, address_line2, city, state, zip_code,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
      `).run(
        finalW9Id,
        userId,
        legal_name,
        business_name || null,
        tax_classification,
        tin_type,
        tin_last_4,
        tin_hash,
        address_line1,
        address_line2 || null,
        city,
        state,
        zip_code,
        now,
        now
      );
    }

    // Log Digital Signature Audit Event
    const sigId = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    db.prepare(`
      INSERT INTO digital_signature_logs (
        id, w9_id, user_id, signature_name, ip_address, user_agent, consent_agreed, signed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(sigId, finalW9Id, userId, signature_name, ipAddress, userAgent, now);

    return res.json({
      success: true,
      message: 'W-9 Form submitted and digitally signed successfully.',
      w9: {
        id: finalW9Id,
        user_id: userId,
        legal_name,
        business_name,
        tax_classification,
        tin_type,
        tin_last_4,
        status: 'submitted',
        updated_at: now,
      },
    });
  } catch (err: any) {
    console.error('W-9 Submission Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get User's W-9 Form & Digital Signature History
taxComplianceRouter.get('/w9', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const w9 = db.prepare('SELECT id, user_id, legal_name, business_name, tax_classification, tin_type, tin_last_4, address_line1, address_line2, city, state, zip_code, status, created_at, updated_at FROM creator_w9_forms WHERE user_id = ?').get(userId) as any;

    if (!w9) {
      return res.json({ success: true, w9: null, signatureLogs: [] });
    }

    const signatureLogs = db.prepare('SELECT id, signature_name, ip_address, user_agent, consent_agreed, signed_at FROM digital_signature_logs WHERE w9_id = ? ORDER BY signed_at DESC').all(w9.id) as any[];

    return res.json({
      success: true,
      w9,
      signatureLogs,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Aggregate Yearly Creator Earnings & IRS 1099-MISC Threshold Evaluation
taxComplianceRouter.get('/earnings-summary', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Aggregate commissions paid/earned in target year from commission_ledger and affiliate_payout_logs
    const commEarnings = (db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger
      WHERE referrer_user_id = ? AND strftime('%Y', created_at) = ? AND status IN ('approved', 'paid')
    `).get(userId, year.toString()) as any)?.total || 0;

    const affiliateEarnings = (db.prepare(`
      SELECT COALESCE(SUM(earnings_cents), 0) as total FROM affiliate_payout_logs
      WHERE user_id = ? AND strftime('%Y', created_at) = ?
    `).get(userId, year.toString()) as any)?.total || 0;

    const programEarnings = (db.prepare(`
      SELECT COALESCE(SUM(earnings_cents), 0) as total FROM program_tracker
      WHERE user_id = ? AND strftime('%Y', date) = ?
    `).get(userId, year.toString()) as any)?.total || 0;

    const totalGrossCents = commEarnings + affiliateEarnings + programEarnings;
    const totalGrossUsd = (totalGrossCents / 100).toFixed(2);
    const thresholdUsd = 600.00;
    const thresholdExceeded = totalGrossCents >= 60000;

    const w9 = db.prepare('SELECT status FROM creator_w9_forms WHERE user_id = ?').get(userId) as any;
    const w9Submitted = !!w9 && w9.status !== 'rejected';

    return res.json({
      success: true,
      year,
      summary: {
        totalGrossCents,
        totalGrossUsd,
        commissionEarningsCents: commEarnings,
        affiliateEarningsCents: affiliateEarnings,
        programEarningsCents: programEarnings,
        irsThresholdUsd: thresholdUsd,
        thresholdExceeded,
        w9Submitted,
        w9Status: w9 ? w9.status : 'missing',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Generate & Export 1099-MISC Tax Document (JSON / CSV Format)
taxComplianceRouter.post('/1099-export', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const year = parseInt(req.body.year) || new Date().getFullYear();

    const w9 = db.prepare('SELECT * FROM creator_w9_forms WHERE user_id = ?').get(userId) as any;
    if (!w9) {
      return res.status(400).json({ success: false, error: 'A completed W-9 form is required before generating a 1099-MISC export.' });
    }

    const user = db.prepare('SELECT display_name, email FROM users WHERE id = ?').get(userId) as any;

    // Calculate yearly earnings
    const commEarnings = (db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total FROM commission_ledger
      WHERE referrer_user_id = ? AND strftime('%Y', created_at) = ? AND status IN ('approved', 'paid')
    `).get(userId, year.toString()) as any)?.total || 0;

    const affiliateEarnings = (db.prepare(`
      SELECT COALESCE(SUM(earnings_cents), 0) as total FROM affiliate_payout_logs
      WHERE user_id = ? AND strftime('%Y', created_at) = ?
    `).get(userId, year.toString()) as any)?.total || 0;

    const programEarnings = (db.prepare(`
      SELECT COALESCE(SUM(earnings_cents), 0) as total FROM program_tracker
      WHERE user_id = ? AND strftime('%Y', date) = ?
    `).get(userId, year.toString()) as any)?.total || 0;

    const totalGrossCents = commEarnings + affiliateEarnings + programEarnings;
    const thresholdExceeded = totalGrossCents >= 60000 ? 1 : 0;
    const now = new Date().toISOString();

    const exportPayload = {
      payer: {
        name: 'MoneyPlugHub Inc.',
        tin: '12-3456789',
        address: '100 Sovereign Way, Suite 500, Austin, TX 78701',
      },
      recipient: {
        userId: userId,
        legalName: w9.legal_name,
        businessName: w9.business_name || '',
        email: user?.email || '',
        taxClassification: w9.tax_classification,
        tinType: w9.tin_type,
        tinLast4: w9.tin_last_4,
        address: `${w9.address_line1}${w9.address_line2 ? ' ' + w9.address_line2 : ''}, ${w9.city}, ${w9.state} ${w9.zip_code}`,
      },
      taxYear: year,
      box3_other_income: (totalGrossCents / 100).toFixed(2),
      gross_earnings_cents: totalGrossCents,
      threshold_exceeded: thresholdExceeded === 1,
      generatedAt: now,
    };

    const exportId = `exp_1099_${userId}_${year}`;

    db.prepare(`
      INSERT OR REPLACE INTO tax_1099_exports (
        id, year, user_id, gross_earnings_cents, threshold_exceeded, status, export_data_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'generated', ?, ?)
    `).run(
      exportId,
      year,
      userId,
      totalGrossCents,
      thresholdExceeded,
      JSON.stringify(exportPayload),
      now
    );

    // CSV format generation for IRS/Tax Software import
    const csvHeader = 'Tax Year,Payer Name,Payer TIN,Recipient Legal Name,Recipient TIN Type,Recipient TIN Last 4,Address,City,State,Zip Code,Box 3 Nonemployee Compensation / Other Income (USD)\n';
    const csvRow = `"${year}","MoneyPlugHub Inc.","12-3456789","${w9.legal_name}","${w9.tin_type}","XXX-XX-${w9.tin_last_4}","${w9.address_line1}","${w9.city}","${w9.state}","${w9.zip_code}","${(totalGrossCents / 100).toFixed(2)}"\n`;

    return res.json({
      success: true,
      exportId,
      payload: exportPayload,
      csvContent: csvHeader + csvRow,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get User's 1099 Export History
taxComplianceRouter.get('/1099-exports', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const exportsList = db.prepare('SELECT id, year, user_id, gross_earnings_cents, threshold_exceeded, status, export_data_json, created_at FROM tax_1099_exports WHERE user_id = ? ORDER BY year DESC').all(userId) as any[];

    return res.json({
      success: true,
      exports: exportsList.map(e => ({
        ...e,
        export_data: JSON.parse(e.export_data_json),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
