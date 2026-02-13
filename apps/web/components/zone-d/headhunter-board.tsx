"use client";

import { Crown } from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import { AddressLabel } from "@/components/shared/address-label";
import { AnimatedNumber } from "@/components/shared/animated-number";

export function HeadhunterBoard() {
  const { state } = useGameState();

  const top5 = [...state.headhunters]
    .sort((a, b) => b.kills - a.kills)
    .filter((h) => h.kills > 0)
    .slice(0, 5);

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Headhunters
      </h3>
      <div className="space-y-1">
        {top5.map((hunter, i) => (
          <div
            key={hunter.address}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
          >
            <span className="w-4 text-center text-muted-foreground">
              {i === 0 ? (
                <Crown className="inline h-3 w-3 text-danger" />
              ) : (
                `${i + 1}`
              )}
            </span>
            <AddressLabel address={hunter.address} className="flex-1" />
            <AnimatedNumber
              value={hunter.kills}
              format={(n) => `${n}`}
              className="tabular-nums font-medium text-death"
            />
          </div>
        ))}
        {top5.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">
            No kills recorded
          </p>
        )}
      </div>
    </div>
  );
}
