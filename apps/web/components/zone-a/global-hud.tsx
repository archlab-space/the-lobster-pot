"use client";

import { SystemPulse } from "./system-pulse";
import { NewsTicker } from "./news-ticker";

export function GlobalHud() {
  return (
    <div className="flex h-12 items-center gap-4 border-b border-border bg-card/50 px-4">
      <SystemPulse />
      <div className="mx-2 h-6 w-px bg-border" />
      <NewsTicker />
    </div>
  );
}
