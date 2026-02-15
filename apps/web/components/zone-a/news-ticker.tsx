"use client";

import {
  Skull,
  Crown,
  TrendingUp,
  UserPlus,
  Landmark,
  AlertTriangle,
  Vote,
  BadgeDollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  Gift,
  Coins,
  Settings,
} from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import { truncateAddress, formatTaxRate, parseWei } from "@/lib/format";
import type { GameEvent, GameEventType } from "@/lib/types";

const eventIcons: Record<GameEventType, React.ElementType> = {
  PLAYER_PURGED: Skull,
  PLAYER_ENTERED: UserPlus,
  PLAYER_DEPOSITED: ArrowDownToLine,
  PLAYER_WITHDREW: ArrowUpFromLine,
  TAX_RATE_CHANGED: TrendingUp,
  TAX_SETTLED: Receipt,
  TREASURY_DISTRIBUTION: Landmark,
  VOTE_CAST: Vote,
  DELINQUENT_SETTLED: AlertTriangle,
  CAMPAIGN_STARTED: Crown,
  CAMPAIGN_FUNDED: Coins,
  BRIBE_UPDATED: BadgeDollarSign,
  REWARD_DISTRIBUTED: Landmark,
  REWARD_CLAIMED: Gift,
  VOTER_REWARD_DISTRIBUTED: Landmark,
  GAME_INITIALIZED: Settings,
};

const eventColors: Record<GameEventType, string> = {
  PLAYER_PURGED: "text-death",
  PLAYER_ENTERED: "text-krill",
  PLAYER_DEPOSITED: "text-krill",
  PLAYER_WITHDREW: "text-danger",
  TAX_RATE_CHANGED: "text-danger",
  TAX_SETTLED: "text-muted-foreground",
  TREASURY_DISTRIBUTION: "text-danger",
  VOTE_CAST: "text-royalty",
  DELINQUENT_SETTLED: "text-delinquent",
  CAMPAIGN_STARTED: "text-royalty",
  CAMPAIGN_FUNDED: "text-royalty",
  BRIBE_UPDATED: "text-krill",
  REWARD_DISTRIBUTED: "text-krill",
  REWARD_CLAIMED: "text-krill",
  VOTER_REWARD_DISTRIBUTED: "text-krill",
  GAME_INITIALIZED: "text-muted-foreground",
};

function formatEvent(event: GameEvent): string {
  switch (event.type) {
    case "PLAYER_PURGED":
      return `${truncateAddress(event.data.victim as string)} liquidated by ${truncateAddress(event.data.killer as string)}`;
    case "PLAYER_ENTERED":
      return `${truncateAddress(event.data.player as string)} entered the pot`;
    case "PLAYER_DEPOSITED":
      return `${truncateAddress(event.data.player as string)} deposited SHELL`;
    case "PLAYER_WITHDREW":
      return `${truncateAddress(event.data.player as string)} withdrew SHELL`;
    case "TAX_RATE_CHANGED": {
      const oldRate = formatTaxRate(parseWei(String(event.data.oldRate)));
      const newRate = formatTaxRate(parseWei(String(event.data.newRate)));
      return `Tax rate changed: ${oldRate} → ${newRate}`;
    }
    case "TREASURY_DISTRIBUTION":
      return `Treasury distributed KRILL to ${truncateAddress(event.data.to as string)}`;
    case "VOTE_CAST":
      return `${truncateAddress(event.data.voter as string)} voted for ${truncateAddress(event.data.candidate as string)}`;
    case "DELINQUENT_SETTLED":
      return `${truncateAddress(event.data.victim as string)} settled as delinquent`;
    case "CAMPAIGN_STARTED":
      return `${truncateAddress(event.data.candidate as string)} launched campaign`;
    case "BRIBE_UPDATED":
      return `${truncateAddress(event.data.candidate as string)} updated bribe`;
    default:
      return event.type;
  }
}

function TickerItem({ event }: { event: GameEvent }) {
  const Icon = eventIcons[event.type] ?? Settings;
  const color = eventColors[event.type] ?? "text-muted-foreground";

  return (
    <span className={`inline-flex items-center gap-1.5 px-4 ${color}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="whitespace-nowrap text-xs">{formatEvent(event)}</span>
    </span>
  );
}

export function NewsTicker() {
  const { state } = useGameState();
  const recentEvents = state.events.slice(0, 20);

  if (recentEvents.length === 0) {
    return (
      <div className="flex-1 overflow-hidden text-xs text-muted-foreground">
        Waiting for events...
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="animate-ticker flex">
        {/* Duplicate for seamless loop */}
        {[...recentEvents, ...recentEvents].map((event, i) => (
          <TickerItem key={`${event.id}-${i}`} event={event} />
        ))}
      </div>
    </div>
  );
}
