"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface PurgeEffectProps {
  x: number;
  y: number;
}

export function PurgeEffect({ x, y }: PurgeEffectProps) {
  const particles = useMemo(() => {
    const count = 8 + Math.floor(Math.random() * 5);
    return Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 30 + Math.random() * 40;
      return {
        id: i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        size: 3 + Math.random() * 4,
        delay: Math.random() * 0.1,
      };
    });
  }, []);

  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-death"
          style={{
            width: p.size,
            height: p.size,
            left: 0,
            top: 0,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.2 }}
          transition={{
            duration: 0.6,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
