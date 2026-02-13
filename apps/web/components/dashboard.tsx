"use client";

import { GameContext } from "@/hooks/use-game-state";
import { useGameEngine } from "@/hooks/use-game-engine";
import { GlobalHud } from "@/components/zone-a/global-hud";
import { ThroneRoom } from "@/components/zone-b/throne-room";
import { ThePot } from "@/components/zone-c/the-pot";
import { TheLedger } from "@/components/zone-d/the-ledger";
import { ScreenFlash } from "@/components/shared/screen-flash";

export function Dashboard() {
  const { state, latestEvent } = useGameEngine();

  return (
    <GameContext value={{ state, latestEvent }}>
      <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden">
        {/* Zone A: Global HUD */}
        <GlobalHud />

        {/* Zones B, C, D */}
        <div className="grid min-h-0 grid-cols-[280px_1fr_300px]">
          {/* Zone B: Throne Room */}
          <ThroneRoom />

          {/* Zone C: The Pot */}
          <ThePot />

          {/* Zone D: The Ledger */}
          <TheLedger />
        </div>
      </div>

      <ScreenFlash />
    </GameContext>
  );
}
