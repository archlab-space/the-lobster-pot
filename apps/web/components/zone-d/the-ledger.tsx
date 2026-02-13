"use client";

import { KillFeed } from "./kill-feed";
import { HeadhunterBoard } from "./headhunter-board";
import { Graveyard } from "./graveyard";
import { Separator } from "@/components/ui/separator";

export function TheLedger() {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-death">
        The Ledger
      </h2>
      <KillFeed />
      <Separator />
      <HeadhunterBoard />
      <Separator />
      <Graveyard />
    </div>
  );
}
