"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Skull } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGameState } from "@/hooks/use-game-state";
import { truncateAddress } from "@/lib/format";
import type { GameEvent } from "@/lib/types";

function isKillEvent(event: GameEvent): boolean {
  if (event.type === "PLAYER_PURGED") return true;
  if (event.type === "DELINQUENT_SETTLED") {
    return String(event.data.died) === "true";
  }
  return false;
}

export function KillFeed() {
  const { state } = useGameState();
  const kills = state.events.filter(isKillEvent).slice(0, 15);

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Kill Feed
      </h3>
      <ScrollArea className="h-[180px]">
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {kills.map((event, i) => {
              const victim = event.data.victim as string;
              const killer = (event.data.killer ?? event.data.settler) as string;
              const isDelinquent = event.type === "DELINQUENT_SETTLED";

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 20, height: 0 }}
                  animate={{ opacity: 1 - i * 0.06, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
                >
                  <Skull className="h-3 w-3 shrink-0 text-death" />
                  <span className="text-death">
                    {truncateAddress(victim)}
                  </span>
                  <span className="text-muted-foreground">
                    {isDelinquent ? "settled by" : "killed by"}
                  </span>
                  <span className="text-foreground">
                    {truncateAddress(killer)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {kills.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">
              No kills yet...
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
