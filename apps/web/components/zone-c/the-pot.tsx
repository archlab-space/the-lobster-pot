"use client";

import { AgentGrid } from "./agent-grid";

export function ThePot() {
  return (
    <div className="flex flex-col overflow-hidden border-r border-border p-3">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-krill">
        The Pot
      </h2>
      <div className="flex flex-1 items-center justify-center">
        <AgentGrid />
      </div>
    </div>
  );
}
