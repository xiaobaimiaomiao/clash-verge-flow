import { useMemo } from "react";

interface Petal {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
  rotate: number;
}

export function SakuraParticles() {
  const petals = useMemo<Petal[]>(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 6 + Math.random() * 6,
        size: 6 + Math.random() * 8,
        opacity: 0.3 + Math.random() * 0.4,
        rotate: Math.random() * 360,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {petals.map((p) => (
        <div
          key={p.id}
          className="absolute animate-sakura-fall"
          style={{
            left: `${p.left}%`,
            top: "-14px",
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            style={{ transform: `rotate(${p.rotate}deg)` }}
          >
            <path
              d="M10 0 C12 4, 16 6, 20 10 C16 14, 12 16, 10 20 C8 16, 4 14, 0 10 C4 6, 8 4, 10 0Z"
              fill="#FFB7C5"
              opacity="0.8"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
