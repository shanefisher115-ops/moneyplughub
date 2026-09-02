import React, { useRef, useEffect } from 'react';
import { Sparkles, Compass, ShieldCheck } from 'lucide-react';

interface PrimordiaWarpGateModalProps {
  targetRealm: string;
  isOpen: boolean;
  onComplete: () => void;
  xpLevel?: number;
}

export const PrimordiaWarpGateModal: React.FC<PrimordiaWarpGateModalProps> = ({
  targetRealm,
  isOpen,
  onComplete,
  xpLevel = 5,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let animId: number;
    let progress = 0;
    const stars: Array<{ x: number; y: number; z: number; o: number }> = [];

    for (let i = 0; i < 400; i++) {
      stars.push({
        x: (Math.random() - 0.5) * canvas.width * 2,
        y: (Math.random() - 0.5) * canvas.height * 2,
        z: Math.random() * canvas.width,
        o: Math.random() * 0.8 + 0.2,
      });
    }

    const render = () => {
      progress += 0.025 * (1 + (xpLevel * 0.05));
      ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw Warp Hyperspace Stars
      for (const s of stars) {
        s.z -= 18 + (progress * 30);
        if (s.z <= 0) {
          s.z = canvas.width;
          s.x = (Math.random() - 0.5) * canvas.width * 2;
          s.y = (Math.random() - 0.5) * canvas.height * 2;
        }

        const k = 250 / s.z;
        const px = s.x * k + cx;
        const py = s.y * k + cy;

        if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
          const size = (1 - s.z / canvas.width) * 4;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
          ctx.fillStyle = '#10b981';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#06b6d4';
          ctx.fill();
        }
      }

      // Draw Central Wormhole Singularity
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(progress * 5);

      const radius = Math.min(220, progress * 150);
      const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#06b6d4');
      grad.addColorStop(0.7, '#a855f7');
      grad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      if (progress < 1.0) {
        animId = requestAnimationFrame(render);
      } else {
        setTimeout(onComplete, 100);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, xpLevel, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-mono select-none">
      <canvas ref={canvasRef} className="absolute inset-0 block bg-slate-950" />

      {/* Wormhole HUD Centerpiece */}
      <div className="relative z-10 text-center space-y-3 pointer-events-none animate-in zoom-in-75 duration-300">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/50 shadow-2xl shadow-emerald-500/30 backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
          <span className="text-xs font-black text-emerald-300 tracking-widest uppercase">
            PRIMORDIAOS WARP GATE ACTIVE
          </span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-wider drop-shadow-2xl">
          WARPING TO <span className="text-cyan-400">{targetRealm.toUpperCase()}</span>
        </h2>

        <div className="text-xs text-slate-300 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Sigil Glyph Authenticated • Warp Speed {(1 + xpLevel * 0.1).toFixed(1)}x (Level {xpLevel})</span>
        </div>
      </div>
    </div>
  );
};
