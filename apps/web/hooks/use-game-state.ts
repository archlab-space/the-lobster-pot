"use client";

import { createContext, useContext } from "react";
import type { GameState, GameEvent } from "@/lib/types";

interface GameContextValue {
  state: GameState;
  latestEvent: GameEvent | null;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGameState(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGameState must be used within a GameEngineProvider");
  }
  return ctx;
}
