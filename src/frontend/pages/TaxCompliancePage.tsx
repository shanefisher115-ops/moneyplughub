import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, Download, Lock, RefreshCw, PenTool, Hash, Building2, MapPin } from 'lucide-react';

interface W9Data {
  id?: string;
  legal_name: string;
  business_name?: string;
  tax_classification: string;
  tin_type: 'SSN' | 'EIN';
  tin_last_4?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  status?: string;
  updated_at?: string;
}

interface EarningsSummary {
  totalGrossCents: number;
  totalGrossUsd: string;
  commissionEarningsCents: number;
  affiliateEarningsCents: number;
  programEarningsCents: number;
  irsThresholdUsd: number;
  thresholdExceeded: boolean;
  w9Submitted: boolean;
  w9Status: string;
}

interface SignatureLog {
  id: string;
  signature_name: string;
  ip_address: string;
  user_agent: string;
  consent_agreed: number;
  signed_at: string;
}

export const TaxCompliancePage: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // W-9 Form State
  const [w9, setW9] = useState<W9Data>({
    legal_name: '',
    business_name: '',
    tax_classification: 'individual',
    tin_type: 'SSN',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
  });
  const [tinValue, setTinValue] = useState<string>('');
  const [signatureName, setSignatureName] = useState<string>('');
  const [consentAgreed, setConsentAgreed] = useState<boolean>(false);
  const [signatureLogs, setSignatureLogs] = useState<SignatureLog[]>([]);

  // Earnings & 1099 Summary State
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [exportsList, setExportsList] = useState<any[]>([]);

  const fetchTaxData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch W-9 Form Status
      const w9Res = await fetch('/api/tax/w9', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const w9Data = await w9Res.json();
      if (w9Data.success && w9Data.w9) {
        setW9(w9Data.w9);
        setSignatureLogs(w9Data.signatureLogs || []);
      }

      // 2. Fetch Earnings Summary for Year
      const earnRes = await fetch(`/api/tax/earnings-summary?year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const earnData = await earnRes.json();
      if (earnData.success) {
        setSummary(earnData.summary);
      }

      // 3. Fetch 1099 Export History
      const expRes = await fetch('/api/tax/1099-exports', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const expData = await expRes.json();
      if (expData.success) {
        setExportsList(expData.exports || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tax compliance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxData();
  }, [selectedYear]);

  const handleSubmitW9 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!tinValue && !w9.tin_last_4) {
      setError('Full SSN or EIN is required to submit or update your W-9.');
      return;
    }

    if (!consentAgreed) {
      setError('You must check the box to confirm your digital signature consent.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tax/w9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...w9,
          tin_value: tinValue,
          signature_name: signatureName,
          consent_agreed: consentAgreed ? 1 : 0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg('W-9 form and digital signature submitted successfully!');
        setTinValue('');
        fetchTaxData();
      } else {
        setError(data.error || 'W-9 submission failed.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting W-9.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport1099 = async () => {
    setError(null);
    setSuccessMsg(null);
    setExporting(true);

    try {
      const res = await fetch('/api/tax/1099-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ year: selectedYear }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`1099-MISC Export for ${selectedYear} generated successfully!`);

        // Trigger CSV File Download
        const blob = new Blob([data.csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `1099-MISC_${selectedYear}_MoneyPlugHub.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        fetchTaxData();
      } else {
        setError(data.error || 'Failed to generate 1099 export.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating 1099 export.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-sans space-y-8">
      {/* Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 border border-indigo-500/30 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> IRS Tax Compliance & Automated 1099
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Creator Tax Compliance Center
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Collect official W-9 forms, validate TIN/EIN formats, maintain audit-proof digital signature logs, and generate 1099-MISC exports for yearly earnings.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
            <label className="text-xs font-mono text-slate-400 uppercase">Tax Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-slate-950 text-emerald-400 font-black text-sm px-3 py-1.5 rounded-xl border border-emerald-500/30 focus:outline-none cursor-pointer"
            >
              <option value={2026}>2026 Tax Year</option>
              <option value={2025}>2025 Tax Year</option>
              <option value={2024}>2024 Tax Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Yearly Earnings Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Gross Yearly Earnings</div>
          <div className="text-3xl font-black text-emerald-400">
            ${summary ? summary.totalGrossUsd : '0.00'}
          </div>
          <div className="text-xs text-slate-400">
            Aggregated from commissions, affiliate rewards, and program payouts in {selectedYear}.
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">IRS 1099-MISC Threshold</div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-white">$600.00</span>
            {summary?.thresholdExceeded ? (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                Threshold Exceeded
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-medium">
                Below Threshold
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            The IRS requires a 1099-MISC export when creator payouts equal or exceed $600/yr.
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">W-9 Form Status</div>
            <div className="mt-1 flex items-center gap-2">
              {w9.status === 'submitted' || w9.status === 'verified' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-lg font-bold text-emerald-400 uppercase tracking-wide">
                    {w9.status === 'verified' ? 'Verified W-9 On File' : 'Submitted W-9 On File'}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span className="text-lg font-bold text-amber-400 uppercase tracking-wide">
                    Action Required
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleExport1099}
            disabled={exporting || !w9.status}
            className={`w-full py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              w9.status
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {exporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> Export 1099-MISC (CSV/JSON)
              </>
            )}
          </button>
        </div>
      </div>

      {/* W-9 Form Section */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Form W-9 (Request for Taxpayer Identification Number)</h2>
              <p className="text-xs text-slate-400">Encrypted in transit & at rest with AES-256 hashed TIN/EIN storage.</p>
            </div>
          </div>
          {w9.status && (
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
              TIN Last 4: •••-••-{w9.tin_last_4}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmitW9} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Legal Name (as shown on tax return) *</label>
              <input
                type="text"
                required
                value={w9.legal_name}
                onChange={(e) => setW9({ ...w9, legal_name: e.target.value })}
                placeholder="e.g. Jane Doe"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Business / DBA Name (Optional)</label>
              <input
                type="text"
                value={w9.business_name || ''}
                onChange={(e) => setW9({ ...w9, business_name: e.target.value })}
                placeholder="e.g. Jane Doe Media LLC"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Federal Tax Classification *</label>
              <select
                value={w9.tax_classification}
                onChange={(e) => setW9({ ...w9, tax_classification: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="individual">Individual / Sole Proprietor</option>
                <option value="llc">Single-Member / Multi-Member LLC</option>
                <option value="c_corp">C Corporation</option>
                <option value="s_corp">S Corporation</option>
                <option value="partnership">Partnership</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-mono text-slate-400 mb-1">TIN Type *</label>
                <select
                  value={w9.tin_type}
                  onChange={(e) => setW9({ ...w9, tin_type: e.target.value as 'SSN' | 'EIN' })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="SSN">SSN</option>
                  <option value="EIN">EIN</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  {w9.tin_type} (9 Digits) *
                </label>
                <input
                  type="password"
                  value={tinValue}
                  onChange={(e) => setTinValue(e.target.value)}
                  placeholder={w9.status ? `•••-••-${w9.tin_last_4} (Enter to Update)` : `Enter 9-Digit ${w9.tin_type}`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Street Address *</label>
              <input
                type="text"
                required
                value={w9.address_line1}
                onChange={(e) => setW9({ ...w9, address_line1: e.target.value })}
                placeholder="123 Creator Way"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={w9.city}
                  onChange={(e) => setW9({ ...w9, city: e.target.value })}
                  placeholder="Austin"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">State *</label>
                <input
                  type="text"
                  required
                  value={w9.state}
                  onChange={(e) => setW9({ ...w9, state: e.target.value })}
                  placeholder="TX"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">ZIP Code *</label>
                <input
                  type="text"
                  required
                  value={w9.zip_code}
                  onChange={(e) => setW9({ ...w9, zip_code: e.target.value })}
                  placeholder="78701"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Digital Signature Box */}
          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-4">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
              <PenTool className="w-4 h-4" /> Digital Signature Certification
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Under penalties of perjury, I certify that: (1) The number shown on this form is my correct taxpayer identification number, (2) I am a U.S. citizen or other U.S. person, and (3) I authorize MoneyPlugHub Inc. to log my digital signature along with IP address and timestamp telemetry for tax verification.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Type Full Legal Name as Signature *</label>
                <input
                  type="text"
                  required
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-serif italic"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentAgreed}
                    onChange={(e) => setConsentAgreed(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-300">I certify under penalty of perjury that the above information is accurate.</span>
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Submitting & Logging Signature...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" /> Submit Form W-9 & Log Digital Signature
              </>
            )}
          </button>
        </form>
      </div>

      {/* Digital Signature Audit Trail & Export History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Signature Audit Trail */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" /> Digital Signature Audit Logs
          </div>
          {signatureLogs.length === 0 ? (
            <p className="text-xs text-slate-500">No signature logs recorded yet.</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {signatureLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-200">
                    <span>{log.signature_name}</span>
                    <span className="text-[10px] font-mono text-emerald-400">AGREED</span>
                  </div>
                  <div className="text-slate-400 flex items-center justify-between text-[11px]">
                    <span>IP: {log.ip_address}</span>
                    <span>{new Date(log.signed_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 1099 Export History */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" /> 1099 Export History
          </div>
          {exportsList.length === 0 ? (
            <p className="text-xs text-slate-500">No 1099 exports generated for this account yet.</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {exportsList.map((exp) => (
                <div key={exp.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{exp.year} Tax Year 1099-MISC</div>
                    <div className="text-[11px] text-slate-400">
                      Gross: ${(exp.gross_earnings_cents / 100).toFixed(2)} • Generated {new Date(exp.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono uppercase">
                    {exp.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
