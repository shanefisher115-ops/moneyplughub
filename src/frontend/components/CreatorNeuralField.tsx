import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Shield, Activity, Compass, HeartPulse } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CreatorNeuralFieldProps {
  onNavigate?: (tab: string) => void;
}

export type NeuralMoodState = 'CALM_EMERALD' | 'COSMIC_VIOLET' | 'HIGH_VELOCITY_CYAN' | 'ANXIETY_SHIELD_AMBER';

export const CreatorNeuralField: React.FC<CreatorNeuralFieldProps> = ({ onNavigate }) => {
  const { token } = useAuth();
  const [activeMood, setActiveMood] = useState<NeuralMoodState>('CALM_EMERALD');
  const [stressIndex, setStressIndex] = useState(0.12);
  const [harmonicHz, setHarmonicHz] = useState(528);
  const [shortcuts, setShortcuts] = useState<any[]>([
    { label: 'Time Dilation Engine', tab: 'time-dilation', reason: 'High compound interest yield potential' },
    { label: 'Quantum Sigil Forge', tab: 'quantum-sigil', reason: 'Unclaimed XP ready for fractal infusion' },
    { label: 'Swarm Brain Council', tab: 'swarm-brain', reason: '5 AI agents ready for strategy debate' },
  ]);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const fetchNeuralState = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/primordia/nuclear/state', { headers });
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data?.neuralField) {
          setActiveMood(j.data.neuralField.moodState || 'CALM_EMERALD');
          setStressIndex(j.data.neuralField.stressIndex || 0.12);
          setHarmonicHz(j.data.neuralField.suggestedHarmonicHz || 528);
          if (j.data.neuralField.predictiveShortcuts) {
            setShortcuts(j.data.neuralField.predictiveShortcuts);
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchNeuralState();
  }, [token]);

  const handleCalibrate = async (newMood: NeuralMoodState) => {
    setIsCalibrating(true);
    setActiveMood(newMood);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/primordia/nuclear/neural-field/calibrate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ moodState: newMood }),
      });
    } catch {} finally {
      setTimeout(() => setIsCalibrating(false), 600);
    }
  };

  const getMoodAura = () => {
    switch (activeMood) {
      case 'COSMIC_VIOLET':
        return 'from-purple-900/10 via-transparent to-purple-950/20 border-purple-500/30';
      case 'HIGH_VELOCITY_CYAN':
        return 'from-cyan-900/10 via-transparent to-blue-950/20 border-cyan-500/30';
      case 'ANXIETY_SHIELD_AMBER':
        return 'from-amber-900/10 via-transparent to-amber-950/20 border-amber-500/30';
      case 'CALM_EMERALD':
      default:
        return 'from-emerald-900/10 via-transparent to-slate-950/20 border-emerald-500/30';
    }
  };

  return (
    <div className="w-full font-mono">
      {/* Ambient Full-Screen Reactive Tint Overlay */}
      <div
        className={`pointer-events-none fixed inset-0 z-0 transition-all duration-1000 bg-gradient-to-b ${getMoodAura()}`}
      />

      {/* Interactive Neural Field Status Strip */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/90 border border-slate-800 backdrop-blur-xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        
        {/* Left: Mind-Reading State */}
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black shadow-md transition-all ${
            activeMood === 'COSMIC_VIOLET' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' :
            activeMood === 'HIGH_VELOCITY_CYAN' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' :
            activeMood === 'ANXIETY_SHIELD_AMBER' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse' :
            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          }`}>
            <Brain className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="text-[11px] font-black text-white flex items-center gap-2">
              <span>CREATOR NEURAL FIELD</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                activeMood === 'COSMIC_VIOLET' ? 'bg-purple-500/20 text-purple-300' :
                activeMood === 'HIGH_VELOCITY_CYAN' ? 'bg-cyan-500/20 text-cyan-300' :
                activeMood === 'ANXIETY_SHIELD_AMBER' ? 'bg-amber-500/20 text-amber-300' :
                'bg-emerald-500/20 text-emerald-300'
              }`}>
                {activeMood.replace('_', ' ')}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Harmonic: {harmonicHz} Hz Solfeggio</span>
              <span>•</span>
              <span>Stress Index: {(stressIndex * 100).toFixed(0)}% (Low)</span>
            </div>
          </div>
        </div>

        {/* Center: Mood Tuner Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => handleCalibrate('CALM_EMERALD')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
              activeMood === 'CALM_EMERALD'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            🌿 Calm (432Hz)
          </button>
          <button
            onClick={() => handleCalibrate('COSMIC_VIOLET')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
              activeMood === 'COSMIC_VIOLET'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-md shadow-purple-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            🔮 Strategic (528Hz)
          </button>
          <button
            onClick={() => handleCalibrate('HIGH_VELOCITY_CYAN')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
              activeMood === 'HIGH_VELOCITY_CYAN'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            ⚡ Viral Velocity
          </button>
          <button
            onClick={() => handleCalibrate('ANXIETY_SHIELD_AMBER')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
              activeMood === 'ANXIETY_SHIELD_AMBER'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            🛡️ Shield Mode
          </button>
        </div>

        {/* Right: Predictive Shortcuts */}
        {shortcuts.length > 0 && onNavigate && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Compass className="w-3 h-3 text-emerald-400" />
              <span>Predictive:</span>
            </span>
            {shortcuts.slice(0, 2).map((sc, i) => (
              <button
                key={i}
                onClick={() => onNavigate('reality-engine')}
                className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                title={sc.reason}
              >
                <span>{sc.label}</span>
                <span className="text-[9px] text-emerald-400">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
