import React, { useState, useEffect } from 'react';
import {
  FileCheck, Shield, AlertTriangle, CheckCircle, Download,
  Building, User, Hash, Lock, FileText, ArrowLeft, RefreshCw, Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TaxCompliancePageProps {
  onNavigate?: (tab: string) => void;
}

interface W9Data {
  id: string;
  legal_name: string;
  business_name: string;
  tax_classification: string;
  llc_tax_classification?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  tin_type: 'ssn' | 'ein';
  tin_masked: string;
  tin_last4: string;
  digital_signature: string;
  signature_date: string;
  status: 'pending' | 'verified' | 'rejected';
}

interface EarningsData {
  taxYear: number;
  totalCents: number;
  totalUsd: number;
  thresholdCents: number;
  thresholdUsd: number;
  requires1099: boolean;
  monthlyBreakdownUsd: number[];
  w9Status: string;
  hasW9: boolean;
}

export const TaxCompliancePage: React.FC<TaxCompliancePageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [w9, setW9] = useState<W9Data | null>(null);
  const [hasW9, setHasW9] = useState<boolean>(false);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [legalName, setLegalName] = useState<string>('');
  const [businessName, setBusinessName] = useState<string>('');
  const [taxClassification, setTaxClassification] = useState<string>('individual_sole_proprietor');
  const [llcTaxClassification, setLlcTaxClassification] = useState<string>('');
  const [addressLine1, setAddressLine1] = useState<string>('');
  const [addressLine2, setAddressLine2] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [zipCode, setZipCode] = useState<string>('');
  const [tinType, setTinType] = useState<'ssn' | 'ein'>('ssn');
  const [tinInput, setTinInput] = useState<string>('');
  const [digitalSignature, setDigitalSignature] = useState<string>('');
  const [certifyChecked, setCertifyChecked] = useState<boolean>(false);

  // Form Validation
  const [tinValidationErr, setTinValidationErr] = useState<string | null>(null);

  // Admin View State
  const [adminSummary, setAdminSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'creator_w9' | 'earnings_1099' | 'admin_overview'>('creator_w9');

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Load W-9 and Earnings
  useEffect(() => {
    fetchTaxData();
  }, [taxYear]);

  const fetchTaxData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Fetch W-9
      const w9Res = await fetch('/api/tax/w9');
      const w9Data = await w9Res.json();
      if (w9Data.success && w9Data.hasW9 && w9Data.w9) {
        setW9(w9Data.w9);
        setHasW9(true);
        // Pre-fill form fields
        setLegalName(w9Data.w9.legal_name || '');
        setBusinessName(w9Data.w9.business_name || '');
        setTaxClassification(w9Data.w9.tax_classification || 'individual_sole_proprietor');
        setLlcTaxClassification(w9Data.w9.llc_tax_classification || '');
        setAddressLine1(w9Data.w9.address_line1 || '');
        setAddressLine2(w9Data.w9.address_line2 || '');
        setCity(w9Data.w9.city || '');
        setState(w9Data.w9.state || '');
        setZipCode(w9Data.w9.zip_code || '');
        setTinType(w9Data.w9.tin_type || 'ssn');
        setDigitalSignature(w9Data.w9.digital_signature || '');
        setCertifyChecked(true);
      } else {
        setHasW9(false);
        setW9(null);
      }

      // 2. Fetch Earnings for Year
      const earnRes = await fetch(`/api/tax/earnings/${taxYear}`);
      const earnData = await earnRes.json();
      if (earnData.success) {
        setEarnings(earnData);
      }

      // 3. If Admin, fetch Admin summary
      if (user?.role === 'admin') {
        const adminRes = await fetch(`/api/tax/admin/summary?year=${taxYear}`);
        const adminData = await adminRes.json();
        if (adminData.success) {
          setAdminSummary(adminData);
        }
      }
    } catch (err: any) {
      console.error('Error fetching tax compliance data:', err);
      setErrorMessage('Failed to connect to tax compliance server.');
    } finally {
      setLoading(false);
    }
  };

  // Validate TIN client-side
  const handleTinChange = (val: string) => {
    setTinInput(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length > 0 && clean.length !== 9) {
      setTinValidationErr(`${tinType.toUpperCase()} must contain exactly 9 digits (${clean.length}/9 entered).`);
    } else if (/^(\d)\1{8}$/.test(clean)) {
      setTinValidationErr(`Invalid ${tinType.toUpperCase()}: Repetitive dummy numbers are prohibited.`);
    } else {
      setTinValidationErr(null);
    }
  };

  // Submit W-9 Form
  const handleSubmitW9 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!legalName.trim()) {
      setErrorMessage('Legal Taxpayer Name is required.');
      return;
    }
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setErrorMessage('Complete address (street, city, state, ZIP) is required.');
      return;
    }
    if (!tinInput.trim() && !hasW9) {
      setErrorMessage(`${tinType.toUpperCase()} number is required.`);
      return;
    }
    if (tinValidationErr) {
      setErrorMessage(tinValidationErr);
      return;
    }
    if (!digitalSignature.trim()) {
      setErrorMessage('Digital signature certification is required.');
      return;
    }
    if (!certifyChecked) {
      setErrorMessage('You must certify the W-9 tax statements by checking the certification box.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tax/w9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: legalName.trim(),
          business_name: businessName.trim(),
          tax_classification: taxClassification,
          llc_tax_classification: llcTaxClassification.trim(),
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim(),
          city: city.trim(),
          state: state.trim(),
          zip_code: zipCode.trim(),
          tin_type: tinType,
          tin: tinInput.trim() || (w9 ? w9.tin_masked : ''),
          digital_signature: digitalSignature.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || 'W-9 Form successfully certified and on file.');
        setTinInput(''); // Clear plain TIN input from memory
        fetchTaxData();
      } else {
        setErrorMessage(data.error || 'Failed to submit W-9 form.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred submitting the W-9 form.');
    } finally {
      setSubmitting(false);
    }
  };

  // Download 1099-MISC Export
  const handleDownload1099 = () => {
    window.open(`/api/tax/1099/export?year=${taxYear}&format=csv`, '_blank');
  };

  // Admin Batch Download
  const handleBatchDownload1099 = () => {
    window.open(`/api/tax/admin/export-batch?year=${taxYear}&format=csv`, '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans text-slate-200 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
            <Shield className="w-3.5 h-3.5" />
            Automated Tax Compliance & 1099-MISC Pipeline
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            Creator Tax Center & W-9 Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Collect W-9 forms, validate TIN/EIN formats, log cryptographic digital signatures, and export official IRS 1099-MISC records.
          </p>
        </div>

        {/* Status Badge */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
            hasW9 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            {hasW9 ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-xs uppercase font-mono text-slate-400">W-9 Certification Status</div>
            <div className={`text-sm font-bold ${hasW9 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {hasW9 ? 'Verified W-9 Form on File' : 'W-9 Form Required ($600+ threshold)'}
            </div>
            {w9 && (
              <div className="text-[11px] text-slate-500">
                TIN: {w9.tin_masked} • Certified {new Date(w9.signature_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('creator_w9')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'creator_w9'
              ? 'bg-plug-accent text-slate-950 shadow-md shadow-plug-accent/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>W-9 Tax Collector</span>
        </button>

        <button
          onClick={() => setActiveTab('earnings_1099')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'earnings_1099'
              ? 'bg-plug-accent text-slate-950 shadow-md shadow-plug-accent/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Yearly Earnings & 1099-MISC Export</span>
        </button>

        {user?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('admin_overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'admin_overview'
                ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin Tax Summary ({adminSummary?.summary?.total_1099_eligible || 0} Eligible)</span>
          </button>
        )}
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* TAB 1: CREATOR W-9 FORM COLLECTOR */}
      {activeTab === 'creator_w9' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main W-9 Form Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmitW9} className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
              <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-400" />
                    Form W-9: Request for Taxpayer Identification
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Department of the Treasury • Internal Revenue Service (IRS)
                  </p>
                </div>
                {hasW9 && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold">
                    ✓ Verified W-9 Active
                  </span>
                )}
              </div>

              {/* 1. Legal Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                    1. Legal Name (as shown on tax return) *
                  </label>
                  <input
                    type="text"
                    required
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. Alexander Champion"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm focus:border-plug-accent focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                    2. Business Name / Disregarded Entity (Optional)
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Champion Media LLC"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm focus:border-plug-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* 2. Federal Tax Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                    3. Federal Tax Classification *
                  </label>
                  <select
                    value={taxClassification}
                    onChange={(e) => setTaxClassification(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm focus:border-plug-accent focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="individual_sole_proprietor">Individual / Sole Proprietor or Single-Member LLC</option>
                    <option value="c_corporation">C Corporation</option>
                    <option value="s_corporation">S Corporation</option>
                    <option value="partnership">Partnership</option>
                    <option value="trust_estate">Trust / Estate</option>
                    <option value="llc">Limited Liability Company (LLC)</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {taxClassification === 'llc' && (
                  <div>
                    <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                      LLC Tax Code (C=C Corp, S=S Corp, P=Partnership)
                    </label>
                    <input
                      type="text"
                      maxLength={1}
                      value={llcTaxClassification}
                      onChange={(e) => setLlcTaxClassification(e.target.value.toUpperCase())}
                      placeholder="e.g. S"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm focus:border-plug-accent focus:outline-none transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* 3. Address Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                      4. Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="e.g. 742 Evergreen Terrace"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm focus:border-plug-accent focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                      Apt / Suite / Unit (Optional)
                    </label>
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="e.g. Suite 400"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm focus:border-plug-accent focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Springfield"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm focus:border-plug-accent focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      placeholder="CA"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm focus:border-plug-accent focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="90210"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm focus:border-plug-accent focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Taxpayer Identification Number (TIN/EIN Validation) */}
              <div className="p-5 rounded-2xl bg-black/40 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase font-mono text-slate-200 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-plug-accent" />
                    5. Taxpayer Identification Number (TIN / EIN) *
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="tinType"
                        value="ssn"
                        checked={tinType === 'ssn'}
                        onChange={() => setTinType('ssn')}
                        className="accent-emerald-400"
                      />
                      <span>SSN</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="tinType"
                        value="ein"
                        checked={tinType === 'ein'}
                        onChange={() => setTinType('ein')}
                        className="accent-emerald-400"
                      />
                      <span>EIN (Business)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <input
                    type="password"
                    autoComplete="off"
                    value={tinInput}
                    onChange={(e) => handleTinChange(e.target.value)}
                    placeholder={
                      hasW9
                        ? `Certified on file (${w9?.tin_masked}). Enter new number to update.`
                        : tinType === 'ssn' ? '9-Digit SSN (XXX-XX-XXXX)' : '9-Digit EIN (XX-XXXXXXX)'
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-slate-800 text-white text-sm font-mono tracking-wider focus:border-plug-accent focus:outline-none transition-colors"
                  />
                  {tinValidationErr && (
                    <p className="text-xs text-rose-400 font-mono mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {tinValidationErr}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    🔒 Protected by AES/Base64 envelope encryption. Never stored in plain text.
                  </p>
                </div>
              </div>

              {/* 5. Digital Certification & Signature */}
              <div className="p-5 rounded-2xl bg-black/40 border border-slate-800 space-y-4">
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800 font-mono text-[11px]">
                  <strong>Certification Instructions:</strong> Under penalties of perjury, I certify that:
                  <ol className="list-decimal list-inside space-y-1 mt-1 text-slate-400">
                    <li>The number shown on this form is my correct taxpayer identification number.</li>
                    <li>I am not subject to backup withholding because I am exempt or notified by the IRS.</li>
                    <li>I am a U.S. citizen or other U.S. person.</li>
                    <li>The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.</li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={certifyChecked}
                      onChange={(e) => setCertifyChecked(e.target.checked)}
                      className="mt-1 accent-emerald-400 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300">
                      I certify under penalties of perjury that all statements provided in this W-9 digital certification are complete, true, and accurate.
                    </span>
                  </label>

                  <div>
                    <label className="text-xs font-bold uppercase font-mono text-slate-300 block mb-1">
                      Digital Signature (Type Full Legal Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={digitalSignature}
                      onChange={(e) => setDigitalSignature(e.target.value)}
                      placeholder="e.g. Alexander Champion"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-slate-800 text-white text-sm font-serif italic focus:border-plug-accent focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Cryptographically Signing & Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>{hasW9 ? 'Update W-9 Certification & Log Signature' : 'Certify & Submit W-9 Form'}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Tax Information & Digital Signature Audit Trail */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                Digital Signature Audit Trail
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                All W-9 submissions log full cryptographic SHA-256 payload hashes, IP addresses, and timestamps for non-repudiation auditability.
              </p>

              {w9 ? (
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block text-[10px]">CERTIFIED SIGNATURE:</span>
                    <span className="text-emerald-400 font-serif italic text-sm">{w9.digital_signature}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block text-[10px]">SIGNATURE DATE:</span>
                    <span className="text-white">{new Date(w9.signature_date).toLocaleString()}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block text-[10px]">TAXPAYER ID:</span>
                    <span className="text-white">{w9.tin_masked} ({w9.tin_type.toUpperCase()})</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-400 text-xs text-center font-mono">
                  No active W-9 signature on file. Submit the form to generate audit record.
                </div>
              )}
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                IRS 1099 Threshold Guide
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                <li><strong>$600.00 Annual Threshold:</strong> IRS requires MoneyPlugHub to report nonemployee compensation exceeding $600 in a calendar year.</li>
                <li><strong>Tax Form 1099-MISC / 1099-NEC:</strong> Exported directly from your verified ledger data.</li>
                <li><strong>Cryptographic Verification:</strong> All earnings aggregations strictly mirror your verified payout ledger.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: YEARLY EARNINGS & 1099-MISC EXPORT */}
      {activeTab === 'earnings_1099' && (
        <div className="space-y-6">
          {/* Controls Header */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-plug-accent" />
                Yearly Taxable Earnings Aggregator
              </h2>
              <p className="text-xs text-slate-400">
                Aggregates all approved commissions, referral payouts, and earnings for IRS 1099 export.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-mono text-slate-400 font-bold uppercase">Tax Year:</label>
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(parseInt(e.target.value, 10))}
                className="px-3 py-2 rounded-xl bg-black/60 border border-slate-800 text-white font-mono text-sm focus:border-plug-accent focus:outline-none cursor-pointer"
              >
                <option value={2026}>2026 Tax Year</option>
                <option value={2025}>2025 Tax Year</option>
                <option value={2024}>2024 Tax Year</option>
              </select>

              <button
                onClick={handleDownload1099}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Export 1099-MISC CSV</span>
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs font-mono uppercase text-slate-400">Total {taxYear} Gross Earnings</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ${earnings?.totalUsd?.toFixed(2) || '0.00'}
              </div>
              <p className="text-[11px] text-slate-500">Aggregated across all approved ledgers</p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs font-mono uppercase text-slate-400">IRS Reporting Threshold</div>
              <div className="text-2xl font-black text-white font-mono">$600.00</div>
              <p className="text-[11px] text-slate-500">Form 1099-MISC minimum requirement</p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs font-mono uppercase text-slate-400">1099 Filing Eligibility</div>
              <div className={`text-xl font-bold font-mono ${
                earnings?.requires1099 ? 'text-amber-400' : 'text-slate-400'
              }`}>
                {earnings?.requires1099 ? '1099 REQUIRED ($600+)' : 'Below $600 Threshold'}
              </div>
              <p className="text-[11px] text-slate-500">
                {earnings?.requires1099 ? 'Official filing record ready for export' : 'No mandatory IRS 1099 filing required'}
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs font-mono uppercase text-slate-400">W-9 Certification</div>
              <div className={`text-xl font-bold font-mono ${
                hasW9 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {hasW9 ? 'Verified On File' : 'Missing Form W-9'}
              </div>
              <p className="text-[11px] text-slate-500">
                {hasW9 ? `Certified as ${w9?.legal_name}` : 'Submit W-9 in Form tab'}
              </p>
            </div>
          </div>

          {/* Monthly Breakdown Chart/Table */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            <h3 className="text-base font-bold text-white uppercase tracking-wider font-mono">
              Monthly Earnings Breakdown ({taxYear})
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {earnings?.monthlyBreakdownUsd?.map((amt, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-black/40 border border-slate-800 space-y-1">
                  <div className="text-xs font-mono text-slate-400 font-bold uppercase">{monthNames[idx]} {taxYear}</div>
                  <div className="text-base font-black text-white font-mono">${amt.toFixed(2)}</div>
                </div>
              )) || (
                <div className="col-span-full text-center py-6 text-slate-500 text-xs font-mono">
                  Loading monthly earnings ledger...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN TAX SUMMARY OVERVIEW */}
      {activeTab === 'admin_overview' && user?.role === 'admin' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                Admin Tax Compliance & IRS Batch Export
              </h2>
              <p className="text-xs text-slate-400">
                System-wide tax compliance status for all registered creators for tax year {taxYear}.
              </p>
            </div>

            <button
              onClick={handleBatchDownload1099}
              className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Export Master 1099 Batch CSV</span>
            </button>
          </div>

          {/* Creator Table */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase">
                  <th className="pb-3 font-bold">User / Email</th>
                  <th className="pb-3 font-bold">W-9 Status</th>
                  <th className="pb-3 font-bold">TIN Masked</th>
                  <th className="pb-3 font-bold">Gross Earnings ({taxYear})</th>
                  <th className="pb-3 font-bold">1099 Required</th>
                  <th className="pb-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {adminSummary?.creators?.map((c: any) => (
                  <tr key={c.user_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3">
                      <div className="font-bold text-white">{c.display_name}</div>
                      <div className="text-[11px] text-slate-400">{c.email}</div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        c.w9_status === 'verified'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {c.w9_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">
                      {c.w9_tin_masked || '—'}
                    </td>
                    <td className="py-3 font-bold text-emerald-400">
                      ${c.gross_earnings_usd.toFixed(2)}
                    </td>
                    <td className="py-3">
                      <span className={`font-bold ${c.requires_1099 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {c.requires_1099 ? 'YES ($600+)' : 'NO'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <a
                        href={`/api/tax/1099/export?year=${taxYear}&format=csv`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-plug-accent hover:underline font-bold text-[11px]"
                      >
                        1099 CSV →
                      </a>
                    </td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      Loading creator tax summary...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="pt-4 flex items-center justify-between text-xs font-mono text-slate-400">
        <button
          onClick={() => onNavigate?.('overview')}
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Command Center</span>
        </button>

        <button
          onClick={() => onNavigate?.('compliance')}
          className="hover:text-plug-accent transition-colors cursor-pointer"
        >
          Compliance & Safety Policy →
        </button>
      </div>
    </div>
  );
};

export default TaxCompliancePage;
