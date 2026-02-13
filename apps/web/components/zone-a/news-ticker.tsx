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
} from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import { truncateAddress } from "@/lib/format";
import type { GameEvent, GameEventType } from "@/lib/types";

const eventIcons: Record<GameEventType, React.ElementType> = {
  PlayerPurged: Skull,
  PlayerEntered: UserPlus,
  TaxRateChanged: TrendingUp,
  TreasuryDistribution: Landmark,
  VoteCast: Vote,
  DelinquentSettled: AlertTriangle,
  CampaignStarted: Crown,
  BribePerVoteUpdated: BadgeDollarSign,
  RewardDistributed: Landmark,
  VoterRewardDistributed: Landmark,
};

const eventColors: Record<GameEventType, string> = {
  PlayerPurged: "text-death",
  PlayerEntered: "text-krill",
  TaxRateChanged: "text-danger",
  TreasuryDistribution: "text-danger",
  VoteCast: "text-royalty",
  DelinquentSettled: "text-delinquent",
  CampaignStarted: "text-royalty",
  BribePerVoteUpdated: "text-krill",
  RewardDistributed: "text-krill",
  VoterRewardDistributed: "text-krill",
};

function formatEvent(event: GameEvent): string {
  switch (event.type) {
    case "PlayerPurged":
      return `${truncateAddress(event.data.player as string)} liquidated by ${truncateAddress(event.data.purger as string)}`;
    case "PlayerEntered":
      return `${truncateAddress(event.data.player as string)} entered the pot`;
    case "TaxRateChanged":
      return `Tax rate changed: ${((event.data.oldRate as number) / 100).toFixed(1)}% → ${((event.data.newRate as number) / 100).toFixed(1)}%`;
    case "TreasuryDistribution":
      return `Treasury distributed ${(event.data.amount as number).toLocaleString()} KRILL to ${truncateAddress(event.data.to as string)}`;
    case "VoteCast":
      return `${truncateAddress(event.data.voter as string)} voted for ${truncateAddress(event.data.candidate as string)}`;
    case "DelinquentSettled":
      return `${truncateAddress(event.data.player as string)} settled as delinquent — ${(event.data.bounty as number).toLocaleString()} bounty`;
    case "CampaignStarted":
      return `${truncateAddress(event.data.candidate as string)} launched campaign`;
    case "BribePerVoteUpdated":
      return `${truncateAddress(event.data.candidate as string)} updated bribe: ${event.data.oldBribe} → ${event.data.newBribe}`;
    default:
      return event.type;
  }
}

function TickerItem({ event }: { event: GameEvent }) {
  const Icon = eventIcons[event.type];
  const color = eventColors[event.type];

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
