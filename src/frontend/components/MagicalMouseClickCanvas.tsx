import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export type ClickAbilityKey = 
  | 'lightning' 
  | 'frost' 
  | 'inferno' 
  | 'elemental' 
  | 'fractal' 
  | 'vortex' 
  | 'antigravity' 
  | 'plasmatic' 
  | 'chaos';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  ability: ClickAbilityKey;
  extra?: any;
}

export const MagicalMouseClickCanvas: React.FC = () => {
  const { token } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [equippedAbility, setEquippedAbility] = useState<ClickAbilityKey>('lightning');
  const particlesRef = useRef<Particle[]>([]);

  // Fetch user's active cosmetic loadout
  const fetchLoadout = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/economy/store/loadout', { headers });
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data?.clickAbilityKey) {
          setEquippedAbility(j.data.clickAbilityKey);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchLoadout();
  }, [token]);

  // Expose global trigger for live store preview
  useEffect(() => {
    (window as any).triggerMagicalClick = (x: number, y: number, abilityOverride?: ClickAbilityKey) => {
      spawnClickParticles(x, y, abilityOverride || equippedAbility);
    };
    (window as any).setEquippedClickAbility = (ability: ClickAbilityKey) => {
      setEquippedAbility(ability);
    };

    return () => {
      delete (window as any).triggerMagicalClick;
      delete (window as any).setEquippedClickAbility;
    };
  }, [equippedAbility]);

  // Particle Spawner Logic for 9 Abilities
  const spawnClickParticles = (cx: number, cy: number, ability: ClickAbilityKey) => {
    const list = particlesRef.current;

    switch (ability) {
      case 'lightning': {
        // 12-16 high-speed electric sparks + 4 branching bolts
        for (let i = 0; i < 18; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 8 + 3;
          list.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: Math.random() * 15 + 12,
            color: Math.random() > 0.3 ? '#38bdf8' : '#ffffff',
            size: Math.random() * 3 + 2,
            ability: 'lightning',
            extra: { jitter: 4, branches: [] },
          });
        }
        break;
      }

      case 'frost': {
        // 24 hexagonal snowflake crystals & freezing mist
        for (let i = 0; i < 24; i++) {
          const angle = (Math.PI * 2 / 6) * Math.floor(Math.random() * 6) + (Math.random() - 0.5) * 0.4;
          const speed = Math.random() * 5 + 2;
          list.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: Math.random() * 25 + 20,
            color: Math.random() > 0.4 ? '#06b6d4' : '#e0f2fe',
            size: Math.random() * 4 + 2,
            ability: 'frost',
            extra: { spin: (Math.random() - 0.5) * 0.2, rot: Math.random() * Math.PI },
          });
        }
        break;
      }

      case 'inferno': {
        // 28 volcanic fire embers shooting up
        for (let i = 0; i < 28; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 7 + 2;
          list.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2.5, // thermal lift
            life: 1,
            maxLife: Math.random() * 30 + 15,
            color: Math.random() > 0.5 ? '#f97316' : Math.random() > 0.5 ? '#eab308' : '#ef4444',
            size: Math.random() * 5 + 2,
            ability: 'inferno',
          });
        }
        break;
      }

      case 'elemental': {
        // 20 nature leaves & glowing botanical spores
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 4 + 1.5;
          list.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: Math.random() * 35 + 20,
            color: Math.random() > 0.3 ? '#10b981' : '#34d399',
            size: Math.random() * 4 + 3,
            ability: 'elemental',
            extra: { sway: Math.random() * 4, phase: Math.random() * Math.PI },
          });
        }
        break;
      }

      case 'fractal': {
        // 16 rotating sacred mandala geometry rays
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          const speed = 4.5;
          list.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: 26,
            color: i % 2 === 0 ? '#a855f7' : '#c084fc',
            size: 4,
            ability: 'fractal',
            extra: { angle, radius: 0 },
          });
        }
        break;
      }

      case 'vortex': {
        // 30 particles spawning in a ring spiraling inward
        for (let i = 0; i < 30; i++) {
          const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.2;
          const r = Math.random() * 70 + 40;
          list.push({
            x: cx + Math.cos(angle) * r,
            y: cy + Math.sin(angle) * r,
            vx: 0,
            vy: 0,
            life: 1,
            maxLife: 32,
            color: Math.random() > 0.5 ? '#6366f1' : '#818cf8',
            size: Math.random() * 3 + 2,
            ability: 'vortex',
            extra: { originX: cx, originY: cy, currentR: r, currentAngle: angle },
          });
        }
        break;
      }

      case 'antigravity': {
        // 8 expanding levitation rings rising upward
        for (let i = 0; i < 6; i++) {
          list.push({
            x: cx + (Math.random() - 0.5) * 20,
            y: cy,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(Math.random() * 3.5 + 2), // upward levitation
            life: 1,
            maxLife: 35 + i * 4,
            color: '#eab308',
            size: 8 + i * 5,
            ability: 'antigravity',
            extra: { ringRadius: 10 + i * 6 },
          });
        }
        break;
      }

      case 'plasmatic': {
        // 24 dual-tone cyan/magenta plasma shockwaves
        for (let i = 0; i < 24; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 6 + 3;
          list.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: 24,
            color: i % 2 === 0 ? '#06b6d4' : '#ec4899',
            size: Math.random() * 5 + 3,
            ability: 'plasmatic',
          });
        }
        break;
      }

      case 'chaos': {
        // 36 chromatic aberration glitch particles
        for (let i = 0; i < 36; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 9 + 4;
          const channel = i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#10b981' : '#3b82f6';
          list.push({
            x: cx + (Math.random() - 0.5) * 8,
            y: cy + (Math.random() - 0.5) * 8,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            maxLife: 20,
            color: channel,
            size: Math.random() * 4 + 2,
            ability: 'chaos',
            extra: { glitchOffset: (Math.random() - 0.5) * 6 },
          });
        }
        break;
      }
    }
  };

  // Global Pointer / Click Event Listener
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      // Don't trigger if right-clicking
      if (e.button !== 0) return;
      spawnClickParticles(e.clientX, e.clientY, equippedAbility);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [equippedAbility]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 1 / p.maxLife;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = Math.max(0, p.life);
        ctx.save();
        ctx.globalAlpha = alpha;

        if (p.ability === 'lightning') {
          p.x += p.vx + (Math.random() - 0.5) * 4;
          p.y += p.vy + (Math.random() - 0.5) * 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#38bdf8';
          ctx.fill();
        } else if (p.ability === 'frost') {
          p.x += p.vx * 0.95;
          p.y += p.vy * 0.95;
          ctx.translate(p.x, p.y);
          if (p.extra) ctx.rotate(p.extra.rot += p.extra.spin);
          ctx.beginPath();
          ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#06b6d4';
          ctx.fill();
        } else if (p.ability === 'inferno') {
          p.x += p.vx;
          p.y += p.vy;
          p.vy -= 0.1; // accelerate upward
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#f97316';
          ctx.fill();
        } else if (p.ability === 'elemental') {
          p.x += p.vx + Math.sin(p.life * 10 + (p.extra?.phase || 0)) * 1.5;
          p.y += p.vy;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * alpha, p.size * 0.5 * alpha, Math.PI / 4, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#10b981';
          ctx.fill();
        } else if (p.ability === 'fractal') {
          p.x += p.vx;
          p.y += p.vy;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#a855f7';
          ctx.fill();
        } else if (p.ability === 'vortex') {
          if (p.extra) {
            p.extra.currentR = Math.max(0, p.extra.currentR - 3);
            p.extra.currentAngle += 0.2;
            p.x = p.extra.originX + Math.cos(p.extra.currentAngle) * p.extra.currentR;
            p.y = p.extra.originY + Math.sin(p.extra.currentAngle) * p.extra.currentR;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#6366f1';
          ctx.fill();
        } else if (p.ability === 'antigravity') {
          p.x += p.vx;
          p.y += p.vy;
          if (p.extra) p.extra.ringRadius += 0.8;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, (p.extra?.ringRadius || 10) * alpha, (p.extra?.ringRadius || 10) * 0.4 * alpha, 0, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#eab308';
          ctx.stroke();
        } else if (p.ability === 'plasmatic') {
          p.x += p.vx;
          p.y += p.vy;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 12;
          ctx.shadowColor = p.color;
          ctx.fill();
        } else if (p.ability === 'chaos') {
          p.x += p.vx + (Math.random() - 0.5) * 5;
          p.y += p.vy + (Math.random() - 0.5) * 5;
          ctx.beginPath();
          ctx.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fill();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[99999] block"
    />
  );
};
