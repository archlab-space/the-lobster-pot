"use client";

import { AnimatePresence } from "framer-motion";
import { useGameState } from "@/hooks/use-game-state";
import { AgentDot } from "./agent-dot";
import { PurgeEffect } from "./purge-effect";
import { useMemo, useState, useEffect } from "react";

export function AgentGrid() {
  const { state, latestEvent } = useGameState();
  const [purgeEffects, setPurgeEffects] = useState<
    { id: string; gridIndex: number; cols: number }[]
  >([]);

  const activeAgents = state.agents.filter((a) => a.isActive);
  const cols = Math.ceil(Math.sqrt(activeAgents.length));

  // Track purge events for particle effects
  useEffect(() => {
    if (!latestEvent) return;
    if (
      latestEvent.type === "PLAYER_PURGED" ||
      latestEvent.type === "DELINQUENT_SETTLED"
    ) {
      const purgedAddr = latestEvent.data.victim as string;
      const agent = state.agents.find((a) => a.address === purgedAddr);
      if (agent) {
        const effectId = latestEvent.id;
        setPurgeEffects((prev) => [
          ...prev,
          { id: effectId, gridIndex: agent.gridIndex, cols },
        ]);
        setTimeout(() => {
          setPurgeEffects((prev) => prev.filter((e) => e.id !== effectId));
        }, 700);
      }
    }
  }, [latestEvent, state.agents, cols]);

  const gridStyle = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 36px)`,
      gap: "6px",
    }),
    [cols]
  );

  return (
    <div className="relative">
      <div style={gridStyle}>
        <AnimatePresence>
          {activeAgents.map((agent) => (
            <AgentDot key={agent.address} agent={agent} />
          ))}
        </AnimatePresence>
      </div>

      {/* Purge particle effects */}
      {purgeEffects.map((effect) => {
        const row = Math.floor(effect.gridIndex / effect.cols);
        const col = effect.gridIndex % effect.cols;
        const x = col * 42 + 18; // 36px dot + 6px gap, center
        const y = row * 42 + 18;
        return <PurgeEffect key={effect.id} x={x} y={y} />;
      })}
    </div>
  );
}
