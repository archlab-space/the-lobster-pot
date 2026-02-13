"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameState } from "@/hooks/use-game-state";

const flashColors: Record<string, string> = {
  TreasuryDistribution: "rgba(245, 158, 11, 0.15)",
  TaxRateChanged: "rgba(225, 29, 72, 0.15)",
  PlayerPurged: "rgba(225, 29, 72, 0.1)",
  DelinquentSettled: "rgba(249, 115, 22, 0.1)",
};

export function ScreenFlash() {
  const { latestEvent } = useGameState();
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!latestEvent) return;
    const color = flashColors[latestEvent.type];
    if (color) {
      setFlash(color);
      const timer = setTimeout(() => setFlash(null), 400);
      return () => clearTimeout(timer);
    }
  }, [latestEvent]);

  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash + Date.now()}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            boxShadow: `inset 0 0 80px 20px ${flash}`,
          }}
        />
      )}
    </AnimatePresence>
  );
}
