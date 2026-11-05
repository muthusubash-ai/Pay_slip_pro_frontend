import React, { useEffect, useRef } from 'react';

interface DiwaliSparklerProps {
  className?: string;
  showBadge?: boolean;
  badgeSize?: 'xs' | 'sm';
  intensity?: 'gentle' | 'normal' | 'vibrant';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  gravity: number;
  isStar?: boolean;
}

export const DiwaliSparkler: React.FC<DiwaliSparklerProps> = ({
  className = '',
  showBadge = true,
  badgeSize = 'sm',
  intensity = 'normal',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const isHoveredRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Golden sparkler color palette (rich amber, gold, warm white, ruby orange)
    // High contrast against both pure white and pitch dark backgrounds
    const sparklerColors = [
      '#FFD700', // Classic Rich Gold
      '#F59E0B', // Amber 500
      '#FBBF24', // Yellow 400
      '#EA580C', // Orange 600
      '#FEF08A', // Pale Gold Spark
      '#FFFFFF', // White hot core
    ];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(rect.width * dpr, 60 * dpr);
      canvas.height = Math.max(rect.height * dpr, 60 * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const createSpark = (originX: number, originY: number, angleOffset = 0, speedMult = 1): Particle => {
      // Sparks eject primarily upward and outward (-PI/2)
      const baseAngle = -Math.PI / 2 + angleOffset;
      const spread = (Math.random() - 0.5) * 1.5;
      const angle = baseAngle + spread;
      const speed = (1.0 + Math.random() * 2.4) * speedMult;
      const color = sparklerColors[Math.floor(Math.random() * sparklerColors.length)];

      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 1.2 + Math.random() * 1.8,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.025,
        gravity: 0.05 + Math.random() * 0.04,
        isStar: Math.random() > 0.65,
      };
    };

    let tick = 0;
    const emitInterval = intensity === 'gentle' ? 6 : intensity === 'vibrant' ? 3 : 4;

    const render = () => {
      tick++;

      // Stop processing if tab is hidden
      if (!document.hidden) {
        const rect = canvas.getBoundingClientRect();
        // Origin is the top-right corner of the logo box area
        const originX = rect.width * 0.72;
        const originY = rect.height * 0.32;

        // Emit continuous sparkler sparks
        if (tick % emitInterval === 0) {
          const count = isHoveredRef.current ? 3 : 1;
          for (let i = 0; i < count; i++) {
            if (particlesRef.current.length < 35) {
              particlesRef.current.push(createSpark(originX, originY));
            }
          }
        }

        // Draw and update
        ctx.clearRect(0, 0, rect.width, rect.height);

        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.vx *= 0.98; // slight drag
          p.alpha -= p.decay;

          if (p.alpha <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 5;
          ctx.shadowColor = p.color;

          if (p.isStar && p.size > 1.8) {
            // Draw tiny 4-pointed sparkle star
            const s = p.size * 1.3;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - s);
            ctx.lineTo(p.x + s * 0.25, p.y - s * 0.25);
            ctx.lineTo(p.x + s, p.y);
            ctx.lineTo(p.x + s * 0.25, p.y + s * 0.25);
            ctx.lineTo(p.x, p.y + s);
            ctx.lineTo(p.x - s * 0.25, p.y + s * 0.25);
            ctx.lineTo(p.x - s, p.y);
            ctx.lineTo(p.x - s * 0.25, p.y - s * 0.25);
            ctx.closePath();
            ctx.fill();
          } else {
            // Draw spark point
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [intensity]);

  // Burst on hover or click
  const triggerBurst = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const originX = rect.width * 0.72;
    const originY = rect.height * 0.32;

    const sparklerColors = ['#FFD700', '#F59E0B', '#FBBF24', '#EA580C', '#FEF08A', '#FFFFFF'];
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.8;
      particlesRef.current.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: sparklerColors[Math.floor(Math.random() * sparklerColors.length)],
        size: 1.4 + Math.random() * 1.8,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.02,
        gravity: 0.04,
        isStar: Math.random() > 0.5,
      });
    }
  };

  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none overflow-visible ${className}`}
      onMouseEnter={() => {
        isHoveredRef.current = true;
        triggerBurst();
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
      }}
    >
      {/* Canvas for emitting sparks beyond logo bounds */}
      <canvas
        ref={canvasRef}
        className="absolute -top-6 -right-6 -bottom-4 -left-4 w-[calc(100%+2.5rem)] h-[calc(100%+2.5rem)] pointer-events-none z-10"
      />

      {/* Festive Diya / Sparkler Corner Glow Badge */}
      {showBadge && (
        <span
          className={`absolute -top-1 -right-1 z-20 flex items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-300 text-amber-950 font-bold shadow-md shadow-amber-500/40 ring-1 ring-white/60 dark:ring-black/60 animate-pulse cursor-pointer pointer-events-auto ${
            badgeSize === 'xs' ? 'w-3.5 h-3.5 text-[8px]' : 'w-4 h-4 text-[9px]'
          }`}
          title="Happy Diwali! ✨ (Click for sparks)"
          onClick={(e) => {
            e.stopPropagation();
            triggerBurst();
          }}
        >
          🪔
        </span>
      )}
    </div>
  );
};

export default DiwaliSparkler;

