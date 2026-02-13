"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useGameState } from "@/hooks/use-game-state";
import { AddressLabel } from "@/components/shared/address-label";
import { formatKrill } from "@/lib/format";

export function Graveyard() {
  const { state } = useGameState();
  const { deadAgents } = state;

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Graveyard ({deadAgents.length})
      </h3>
      <ScrollArea className="h-[160px]">
        <div className="space-y-1">
          {deadAgents.map((dead) => (
            <div
              key={`${dead.address}-${dead.block}`}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
            >
              <AddressLabel address={dead.address} className="flex-1" />
              <Badge
                variant="outline"
                className={`text-[9px] ${
                  dead.cause === "PURGED"
                    ? "border-death/30 text-death"
                    : "border-delinquent/30 text-delinquent"
                }`}
              >
                {dead.cause}
              </Badge>
              <span className="tabular-nums text-muted-foreground">
                {formatKrill(dead.krillAtDeath)}
              </span>
            </div>
          ))}
          {deadAgents.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">
              No graves yet...
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
