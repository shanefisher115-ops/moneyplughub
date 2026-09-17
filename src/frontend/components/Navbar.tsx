import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLivingRealm } from '../context/LivingRealmContext';
import { useAdaptiveProfile } from '../context/AdaptiveProfileContext';
import { 
  Zap, Shield, LogOut, LayoutDashboard, PieChart, 
  Target, Trophy, Wallet, Users, Sparkles, Gift, Compass, Cpu, Bot, 
  ShieldCheck, Calculator, Brain, Rocket, Crown, BarChart3, Swords, Coins, 
  ChevronDown, Menu, X, User as UserIcon, Orbit, Film, Send, Database
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenWizard?: () => void;
  onOpenXpConversion?: () => void;
  onOpenSupabase?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, onOpenWizard, onOpenXpConversion, onOpenSupabase }) => {
  const { user, logout } = useAuth();
  const { openPassport } = useLivingRealm();
  const { profile, setIsCalibrationModalOpen } = useAdaptiveProfile();

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const moreMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const secondaryTabs = [
    { id: 'supabase', label: '🗄️ Supabase Cloud', icon: Database, color: 'text-emerald-400' },
    { id: 'signal-realm', label: '📡 Signal Realm', icon: Send, color: 'text-cyan-400' },
    { id: 'creator-os', label: '🎨 Creator OS Studio', icon: Sparkles, color: 'text-pink-400' },
    { id: 'video', label: '🎬 Omni Flash & Loops', icon: Film, color: 'text-pink-400' },
    { id: 'reality-engine', label: '☢️ Reality Engine', icon: Orbit, color: 'text-cyan-400' },
    { id: 'agent-swarm', label: '🤖 Agent Swarm Protocol', icon: Bot, color: 'text-emerald-400' },
    { id: 'net-worth', label: 'Living Vault', icon: Wallet, color: 'text-amber-400', minLevel: 3 },
    { id: 'budget', label: 'Budget Shield', icon: PieChart, color: 'text-sky-400', minLevel: 3 },
    { id: 'generate', label: 'AI Studio', icon: Sparkles, color: 'text-pink-400', minLevel: 6 },
    { id: 'quests', label: 'Quests & Loot', icon: Trophy, color: 'text-yellow-400', minLevel: 3 },
    { id: 'achievements', label: 'Trophies & Prestige', icon: Crown, color: 'text-amber-400' },
    { id: 'syndicates', label: 'Syndicates', icon: Swords, color: 'text-emerald-400' },
    { id: 'primordia', label: 'PrimordiaOS', icon: Cpu, color: 'text-cyan-400' },
    ...(user?.role === 'admin' ? [{ id: 'analytics', label: 'Metrics & DB', icon: BarChart3, color: 'text-cyan-400' }] : [])
  ];

  const isSecondaryActive = secondaryTabs.some(t => t.id === currentTab);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-plug-border/80 bg-plug-dark/95 backdrop-blur-md">
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* ── Left: Brand Logo ── */}
        <button
          onClick={() => {
            setCurrentTab(user ? 'overview' : 'landing');
            setIsMobileNavOpen(false);
          }}
          className="flex items-center gap-2 sm:gap-2.5 group text-left focus:outline-none shrink-0"
        >
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full p-0.5 bg-gradient-to-tr from-emerald-500/40 via-amber-500/40 to-cyan-500/40 shadow-lg shadow-emerald-500/20 group-hover:scale-105 group-hover:shadow-emerald-500/40 transition-all overflow-hidden flex items-center justify-center">
            <img
              src="/moneyplughub_emblem.png"
              alt="MoneyPlugHub Logo"
              className="w-full h-full object-cover rounded-full drop-shadow-md"
            />
          </div>
          <div>
            <div className="font-extrabold tracking-tight text-sm sm:text-base lg:text-lg text-white flex items-center gap-1">
              MoneyPlug<span className="text-plug-accent">Hub</span>
            </div>
            <div className="text-[8px] sm:text-[9px] text-plug-accent font-mono -mt-0.5 tracking-wider uppercase font-bold hidden xs:block">
              Creator Money OS
            </div>
          </div>
        </button>

        {/* ── Center: Core Nav Links (Desktop, Tablet & Laptop) ── */}
        {user ? (
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800 text-xs font-mono shrink min-w-0">
            <button
              onClick={() => setCurrentTab('overview')}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'overview' || currentTab === 'command-center' 
                  ? 'bg-plug-accent/20 text-plug-accent border border-plug-accent/40 shadow-sm' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Command</span>
            </button>

            <button
              onClick={() => setCurrentTab('moneyos')}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'moneyos' || currentTab === 'chat' 
                  ? 'bg-plug-accent/20 text-plug-accent border border-plug-accent/40 shadow-sm' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>MoneyOS</span>
            </button>

            <button
              onClick={() => setCurrentTab('referral-hub')}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'referral-hub' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Referrals</span>
            </button>

            <button
              onClick={() => setCurrentTab('sigil-forge')}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'sigil-forge' 
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Sigil Forge</span>
            </button>

            <button
              onClick={() => setCurrentTab('economy')}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                currentTab === 'economy' || currentTab === 'marketplace' || currentTab === 'ledger'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Market</span>
            </button>

            {/* More Chambers Dropdown */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className={`px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  isSecondaryActive || isMoreMenuOpen
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>Chambers</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180 text-plug-accent' : 'text-slate-400'}`} />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 p-1.5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 py-1 font-bold">
                    Inner Chambers
                  </div>
                  <div className="space-y-0.5">
                    {secondaryTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = currentTab === tab.id;
                      const isLocked = user.role !== 'admin' && tab.minLevel && (user.level || 1) < tab.minLevel;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            if (tab.id === 'supabase') {
                              onOpenSupabase?.();
                            } else {
                              setCurrentTab(tab.id);
                            }
                            setIsMoreMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-plug-accent/20 text-plug-accent font-bold' 
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${tab.color}`} />
                            <span>{tab.label}</span>
                          </div>
                          {isLocked && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                              Lv.{tab.minLevel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-2 text-xs font-mono shrink-0">
            <button
              onClick={() => setCurrentTab('moneyos')}
              className={`px-1.5 py-1 font-bold transition-all relative border-b-2 cursor-pointer ${
                currentTab === 'moneyos' || currentTab === 'chat'
                  ? 'text-white border-emerald-400' 
                  : 'text-slate-400 hover:text-white border-transparent hover:border-emerald-400/50'
              }`}
            >
              MoneyOS
            </button>
            <span className="text-slate-700 select-none">|</span>
            <button
              onClick={() => setCurrentTab('primordia')}
              className={`px-1.5 py-1 font-bold transition-all relative border-b-2 cursor-pointer ${
                currentTab === 'primordia' 
                  ? 'text-white border-cyan-400' 
                  : 'text-slate-400 hover:text-white border-transparent hover:border-cyan-400/50'
              }`}
            >
              PrimordiaOS
            </button>
            <span className="text-slate-700 select-none">|</span>
            <button
              onClick={() => setCurrentTab('landing-calc')}
              className={`px-1.5 py-1 font-bold transition-all relative border-b-2 cursor-pointer ${
                currentTab === 'landing-calc' 
                  ? 'text-white border-emerald-400' 
                  : 'text-slate-400 hover:text-white border-transparent hover:border-emerald-400/50'
              }`}
            >
              Simulator
            </button>
            <span className="text-slate-700 select-none">|</span>
            <button
              onClick={() => setCurrentTab('sigil-forge')}
              className={`px-1.5 py-1 font-bold transition-all relative border-b-2 cursor-pointer ${
                currentTab === 'sigil-forge' 
                  ? 'text-white border-purple-400' 
                  : 'text-slate-400 hover:text-white border-transparent hover:border-purple-400/50'
              }`}
            >
              Sigil Forge
            </button>
            <span className="text-slate-700 select-none">|</span>
            <button
              onClick={() => setCurrentTab('pricing')}
              className={`px-1.5 py-1 font-bold transition-all relative border-b-2 cursor-pointer ${
                currentTab === 'pricing' 
                  ? 'text-white border-amber-400' 
                  : 'text-slate-400 hover:text-white border-transparent hover:border-amber-400/50'
              }`}
            >
              Pricing
            </button>
          </nav>
        )}

        {/* ── Right Controls: Action Badges & Profile Menu ── */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* Category B: User Inventory / Vault (Segmented Split Badge) */}
          <div className="hidden sm:flex items-center bg-slate-900/90 border border-slate-700/80 rounded-full p-0.5 shadow-md">
            <button
              onClick={() => {
                if (typeof (window as any).openDailyLootCrate === 'function') {
                  (window as any).openDailyLootCrate();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Daily Mystery Loot Crate"
            >
              <span>📦</span>
              <span className="text-slate-400">Crates:</span>
              <span className="font-bold text-amber-400">1</span>
            </button>

            <div className="w-px h-3.5 bg-slate-700" />

            <button
              onClick={() => setIsProfileMenuOpen(true)}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Creator Level & Experience"
            >
              <span className="text-amber-400 font-bold">⚡</span>
              <span className="font-bold text-white">Lv.{user?.level || 4}</span>
              <span className="text-slate-400 text-[10px]">| {(user?.xp || 1250).toLocaleString()} XP</span>
            </button>

            <div className="w-px h-3.5 bg-slate-700" />

            <button
              onClick={() => {
                if (onOpenXpConversion) onOpenXpConversion();
                else setCurrentTab('net-worth');
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Claimable Revenue"
            >
              <span className="text-emerald-400">🪙</span>
              <span className="font-bold text-emerald-400">$0.00</span>
              <span className="text-slate-400 text-[10px]">Claimable</span>
            </button>
          </div>

          {user ? (
            <>
              {/* Creator Passport Quick Button on Large screens */}
              <button
                onClick={() => openPassport(user.referral_code)}
                className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 font-mono text-xs font-bold transition-all hover:scale-105 cursor-pointer"
                title="View Cryptographic Creator Passport"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Passport</span>
              </button>

              {/* User Profile Menu & Popover */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition-all cursor-pointer focus:outline-none"
                  title="Creator Profile & Settings"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-plug-accent/30 to-purple-500/30 border border-plug-accent/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {user.display_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-bold text-slate-100 truncate max-w-[100px]">
                      {user.display_name}
                    </div>
                    <div className="text-[9px] text-plug-accent font-mono -mt-0.5 font-semibold">
                      Lv.{user.level || 1} • {user.role === 'admin' ? 'Admin' : (profile?.archetypeTitle || 'Creator')}
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden sm:block ${isProfileMenuOpen ? 'rotate-180 text-plug-accent' : ''}`} />
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 p-2 rounded-2xl bg-slate-900/98 border border-slate-700/80 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
                    {/* User Header */}
                    <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 mb-2">
                      <div className="text-xs font-extrabold text-white truncate">{user.display_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{user.email}</div>
                      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-300">
                        <span>Level {user.level || 1}</span>
                        <span className="text-plug-accent font-bold">{user.xp?.toLocaleString() || 0} XP</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-plug-accent rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((user.xp || 0) % 1000) / 10)}%` }}
                        />
                      </div>
                    </div>

                    {/* Popover Action Links */}
                    <div className="space-y-0.5">
                      <button
                        onClick={() => {
                          setIsCalibrationModalOpen(true);
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                      >
                        <Brain className="w-4 h-4 text-emerald-400" />
                        <span>Neural Calibration Matrix</span>
                      </button>

                      <button
                        onClick={() => {
                          openPassport(user.referral_code);
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                        <span>Creator 3D Passport</span>
                      </button>

                      {onOpenWizard && (
                        <button
                          onClick={() => {
                            onOpenWizard();
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                          <span>Setup Wizard Tour</span>
                        </button>
                      )}

                      {user.role === 'admin' && (
                        <button
                          onClick={() => {
                            setCurrentTab('admin');
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Shield className="w-4 h-4 text-rose-400" />
                          <span>Auditor & System Admin</span>
                        </button>
                      )}

                      <div className="h-px bg-slate-800 my-1" />

                      <button
                        onClick={async () => {
                          setIsProfileMenuOpen(false);
                          await logout();
                          setCurrentTab('landing');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            {/* Category C: Primary Action (Solid Accent Pill vs Ghost Border Only) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentTab('login')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white rounded-full border border-slate-700 hover:border-slate-500 bg-transparent transition-all cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => setCurrentTab('register')}
                className="px-4 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs rounded-full transition-all shadow-lg shadow-emerald-400/25 flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
              >
                <span>Start Free</span>
                <span className="font-bold">→</span>
              </button>
            </div>
          )}

          {/* ── Mobile Hamburger Toggle (under xl screens) ── */}
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="xl:hidden p-1.5 sm:p-2 rounded-xl bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileNavOpen ? <X className="w-4 h-4 text-rose-400" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Navigation Drawer ── */}
      {isMobileNavOpen && (
        <div className="xl:hidden border-t border-slate-800 bg-slate-950/98 backdrop-blur-2xl px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-150 max-h-[85vh] overflow-y-auto">
          {user ? (
            <>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold px-1">
                Core Chambers
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setCurrentTab('overview'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'overview' ? 'bg-plug-accent/20 text-plug-accent border border-plug-accent/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                  <span>Command</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('moneyos'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'moneyos' ? 'bg-plug-accent/20 text-plug-accent border border-plug-accent/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Bot className="w-4 h-4 text-cyan-400" />
                  <span>MoneyOS</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('referral-hub'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'referral-hub' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Referrals</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('sigil-forge'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'sigil-forge' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Compass className="w-4 h-4 text-purple-400" />
                  <span>Sigil Forge</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('economy'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'economy' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Market & Ledger</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('net-worth'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'net-worth' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Wallet className="w-4 h-4 text-amber-400" />
                  <span>Living Vault</span>
                </button>
              </div>

              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold px-1 pt-2">
                Specialized Systems
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setCurrentTab('budget'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'budget' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <PieChart className="w-4 h-4 text-sky-400" />
                  <span>Budget</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('generate'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'generate' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <span>AI Studio</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('quests'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'quests' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span>Quests</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('achievements'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'achievements' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Trophies</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('syndicates'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'syndicates' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Swords className="w-4 h-4 text-emerald-400" />
                  <span>Syndicates</span>
                </button>

                <button
                  onClick={() => { setCurrentTab('primordia'); setIsMobileNavOpen(false); }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold ${
                    currentTab === 'primordia' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>PrimordiaOS</span>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <button
                onClick={() => { setCurrentTab('landing'); setIsMobileNavOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Home
              </button>
              <button
                onClick={() => { setCurrentTab('moneyos'); setIsMobileNavOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-900 text-emerald-300 font-bold text-xs flex items-center gap-2"
              >
                <Bot className="w-4 h-4 text-emerald-400" />
                <span>MoneyOS AI Voice</span>
              </button>
              <button
                onClick={() => { setCurrentTab('video'); setIsMobileNavOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-900 text-pink-300 font-bold text-xs flex items-center gap-2"
              >
                <Film className="w-4 h-4 text-pink-400" />
                <span>Video Studio</span>
              </button>
              <button
                onClick={() => { setCurrentTab('primordia'); setIsMobileNavOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-900 text-cyan-300 font-bold text-xs"
              >
                PrimordiaOS
              </button>
              <button
                onClick={() => { setCurrentTab('landing-calc'); setIsMobileNavOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-900 text-emerald-300 font-bold text-xs"
              >
                Simulator
              </button>
              <button
                onClick={() => { setCurrentTab('sigil-forge'); setIsMobileNavOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-900 text-purple-300 font-bold text-xs"
              >
                Sigil Forge
              </button>
              <button
                onClick={() => { setCurrentTab('pricing'); setIsMobileNavOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl bg-slate-900 text-amber-300 font-bold text-xs"
              >
                Pricing
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
