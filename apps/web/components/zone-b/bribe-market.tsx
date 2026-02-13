"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useGameState } from "@/hooks/use-game-state";
import { AddressLabel } from "@/components/shared/address-label";

export function BribeMarket() {
  const { state } = useGameState();
  const { candidates } = state;

  const sorted = [...candidates].sort(
    (a, b) => b.bribePerVote - a.bribePerVote
  );

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Bribe Market
      </h3>
      <ScrollArea className="h-[140px]">
        <div className="space-y-1">
          {sorted.map((candidate) => (
            <div
              key={candidate.address}
              className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-secondary/50"
            >
              <AddressLabel address={candidate.address} />
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-krill">
                  {candidate.bribePerVote}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  /vote
                </span>
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="text-xs text-muted-foreground">No bribes yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
