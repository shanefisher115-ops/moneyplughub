import React, { useRef, useEffect } from 'react';
import { Volume2, Mic, Zap, Sparkles } from 'lucide-react';

interface MoneyOSHologramAvatarProps {
  personaId?: string; // 'liam' | 'adam' | 'rachel' | 'antoni' | 'josh'
  personaName?: string;
  isSpeaking?: boolean;
  isListening?: boolean;
  themeColor?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const MoneyOSHologramAvatar: React.FC<MoneyOSHologramAvatarProps> = ({
  personaId = 'liam',
  personaName = 'Liam (Vault Sovereign)',
  isSpeaking = false,
  isListening = false,
  themeColor = '#10b981',
  size = 'md',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dim = size === 'sm' ? 90 : size === 'lg' ? 220 : 140;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.035;
      ctx.clearRect(0, 0, dim, dim);

      const cx = dim / 2;
      const cy = dim / 2;
      const baseRadius = (dim / 2) - 16;

      // 1. Holographic scanlines effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let y = 0; y < dim; y += 4) {
        ctx.fillRect(0, y, dim, 1.5);
      }

      // 2. Rotating concentric outer rings
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius + (isSpeaking ? Math.sin(time * 5) * 4 : 0), 0, Math.PI * 2);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = isSpeaking ? 2 : 1;
      ctx.globalAlpha = isSpeaking ? 0.8 : 0.4;
      ctx.setLineDash([6, 8]);
      ctx.stroke();
      ctx.restore();

      // 3. Counter-rotating inner ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-time * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.75, 0, Math.PI * 2);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.restore();

      // 4. Harmonic Facial / Audio Mesh
      const points = 12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();

      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wave = isSpeaking ? Math.sin(time * 8 + i) * 8 : isListening ? Math.sin(time * 3 + i) * 3 : Math.sin(time + i) * 1.5;
        const r = (baseRadius * 0.45) + wave;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, baseRadius * 0.5);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, themeColor);
      grad.addColorStop(1, 'rgba(0,0,0,0.8)');

      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw sacred geometric node points
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wave = isSpeaking ? Math.sin(time * 8 + i) * 8 : Math.sin(time + i) * 1.5;
        const r = (baseRadius * 0.45) + wave;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [dim, isSpeaking, isListening, themeColor]);

  return (
    <div className="flex flex-col items-center justify-center font-mono">
      <div className="relative flex items-center justify-center">
        {/* Ambient Hologram Glow Aura */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-40 transition-all duration-300"
          style={{ backgroundColor: themeColor }}
        />

        <canvas
          ref={canvasRef}
          width={dim}
          height={dim}
          className="relative z-10 block"
        />

        {/* Center Mode Icon */}
        <div className="absolute z-20 pointer-events-none text-slate-950">
          {isSpeaking ? (
            <Volume2 className="w-5 h-5 text-white animate-pulse" />
          ) : isListening ? (
            <Mic className="w-5 h-5 text-emerald-300 animate-bounce" />
          ) : (
            <Zap className="w-4 h-4 text-white opacity-80" />
          )}
        </div>
      </div>

      <div className="mt-1 text-center">
        <div className="text-[11px] font-black text-white truncate">{personaName}</div>
        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: themeColor }}>
          {isSpeaking ? '● Transmitting Voice' : isListening ? '● Receiving Audio' : '● Quantum Standby'}
        </div>
      </div>
    </div>
  );
};
