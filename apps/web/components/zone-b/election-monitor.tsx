"use client";

import { motion } from "framer-motion";
import { useGameState } from "@/hooks/use-game-state";
import { AddressLabel } from "@/components/shared/address-label";

export function ElectionMonitor() {
  const { state } = useGameState();
  const { candidates } = state;

  if (candidates.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Election
        </h3>
        <p className="text-xs text-muted-foreground">No candidates yet</p>
      </div>
    );
  }

  const maxVotes = Math.max(...candidates.map((c) => c.voteCount), 1);
  const sorted = [...candidates].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Election
      </h3>
      <div className="space-y-1.5">
        {sorted.map((candidate, i) => {
          const widthPct = (candidate.voteCount / maxVotes) * 100;
          const isLeading = i === 0 && candidate.voteCount > 0;

          return (
            <div key={candidate.address} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <AddressLabel
                  address={candidate.address}
                  className={isLeading ? "text-royalty" : ""}
                />
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {candidate.voteCount} votes
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className={`h-full rounded-full ${
                    isLeading ? "bg-royalty" : "bg-muted-foreground/40"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
