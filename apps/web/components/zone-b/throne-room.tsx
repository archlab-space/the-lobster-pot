"use client";

import { KingCard } from "./king-card";
import { ElectionMonitor } from "./election-monitor";
import { BribeMarket } from "./bribe-market";
import { Separator } from "@/components/ui/separator";

export function ThroneRoom() {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto border-r border-border p-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-royalty">
        Throne Room
      </h2>
      <KingCard />
      <Separator />
      <ElectionMonitor />
      <Separator />
      <BribeMarket />
    </div>
  );
}
