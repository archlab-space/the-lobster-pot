"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  GameState,
  Agent,
  AgentStatus,
  Candidate,
  GameEvent,
  KingInfo,
  DeadAgent,
} from "@/lib/types";
import { graphqlQuery, QUERIES } from "@/lib/graphql/client";

// ── Types for GraphQL responses ──────────────────────────

interface GlobalStateResponse {
  globalState: {
    treasury: string;
    taxRate: string;
    activePlayers: number;
    currentBlock: string;
    currentKing: string;
    currentTerm: string;
    termStartBlock: string;
    termEndBlock: string;
  } | null;
}

interface PlayersResponse {
  players: Array<{
    id: string;
    address: string;
    krillBalance: string;
    effectiveBalance: string;
    status: string;
    isDelinquent: boolean;
    killCount: number;
    entryCount: number;
    joinedBlock: string;
    lastTaxBlock: string;
  }>;
}

interface DeathsResponse {
  deaths: Array<{
    id: string;
    victim: { address: string };
    killer: { address: string };
    cause: string;
    krillAtDeath: string;
    block: string;
  }>;
}

interface ActivityEventsResponse {
  activityEvents: Array<{
    id: string;
    eventType: string;
    block: string;
    timestamp: string;
    data: string;
  }>;
}

interface TermResponse {
  term: {
    termNumber: string;
    totalCandidates: number;
    totalVotes: number;
    candidates: Array<{
      candidate: { address: string };
      bribePerVote: string;
      campaignFunds: string;
      voteCount: number;
      isLeading: boolean;
    }>;
  } | null;
}

interface LeaderboardResponse {
  players: Array<{
    address: string;
    killCount: number;
  }>;
}

// ── Helpers ──────────────────────────────────────────────

function mapStatusToAgentStatus(status: string): AgentStatus {
  const statusMap: Record<string, AgentStatus> = {
    SAFE: "safe",
    WARNING: "warning",
    CRITICAL: "critical",
    INSOLVENT: "insolvent",
    DELINQUENT: "delinquent",
    DEAD: "dead",
  };
  return statusMap[status] || "safe";
}

function parseEventData(data: string): Record<string, string | number> {
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// ── Fetch real game data ─────────────────────────────────

async function fetchGameState(): Promise<GameState> {
  try {
    // Fetch all data in parallel
    const [globalData, playersData, deathsData, eventsData, leaderboardData] =
      await Promise.all([
        graphqlQuery<GlobalStateResponse>(QUERIES.GLOBAL_HUD),
        graphqlQuery<PlayersResponse>(QUERIES.ACTIVE_PLAYERS),
        graphqlQuery<DeathsResponse>(QUERIES.KILL_FEED, { first: 20 }),
        graphqlQuery<ActivityEventsResponse>(QUERIES.NEWS_TICKER, { first: 50 }),
        graphqlQuery<LeaderboardResponse>(QUERIES.LEADERBOARD),
      ]);

    // Parse global state
    const global = globalData.globalState;
    if (!global) {
      throw new Error("GlobalState not initialized");
    }

    const blockHeight = parseInt(global.currentBlock);
    const treasury = parseInt(global.treasury) / 1e18; // Convert from Wei
    const taxRate = parseInt(global.taxRate) / 1e18; // Convert from Wei
    const activePlayers = global.activePlayers;

    // Map players to agents
    const agents: Agent[] = playersData.players.map((player, index) => ({
      address: player.address,
      krillBalance: parseInt(player.krillBalance) / 1e18,
      effectiveBalance: parseInt(player.effectiveBalance) / 1e18,
      lastTaxBlock: parseInt(player.lastTaxBlock),
      joinedBlock: parseInt(player.joinedBlock),
      isActive: true,
      isInsolvent: player.status === "INSOLVENT",
      isDelinquent: player.isDelinquent,
      status: mapStatusToAgentStatus(player.status),
      kills: player.killCount,
      gridIndex: index,
    }));

    // Map deaths to dead agents
    const deadAgents: DeadAgent[] = deathsData.deaths.map((death) => ({
      address: death.victim.address,
      cause: death.cause as "PURGED" | "DELINQUENT",
      krillAtDeath: parseInt(death.krillAtDeath) / 1e18,
      block: parseInt(death.block),
      killedBy: death.killer.address,
    }));

    // Map activity events to game events
    const events: GameEvent[] = eventsData.activityEvents.map((event) => ({
      id: event.id,
      type: event.eventType.replace(/_/g, "") as GameEvent["type"],
      block: parseInt(event.block),
      timestamp: parseInt(event.timestamp) * 1000, // Convert to ms
      data: parseEventData(event.data),
    }));

    // Create king info
    const king: KingInfo = {
      address: global.currentKing,
      term: parseInt(global.currentTerm),
      taxRate,
      termStartBlock: parseInt(global.termStartBlock),
      termEndBlock: parseInt(global.termEndBlock),
      voterCount: 0, // Will be populated from term query if needed
    };

    // Fetch current election candidates
    let candidates: Candidate[] = [];
    try {
      const chainId = 41454; // Monad chain ID
      const termId = `${chainId}_${global.currentTerm}`;
      const termData = await graphqlQuery<TermResponse>(
        QUERIES.CURRENT_ELECTION,
        { termNumber: termId }
      );

      if (termData.term) {
        candidates = termData.term.candidates.map((c) => ({
          address: c.candidate.address,
          bribePerVote: parseInt(c.bribePerVote) / 1e18,
          campaignFunds: parseInt(c.campaignFunds) / 1e18,
          voteCount: c.voteCount,
        }));
      }
    } catch (error) {
      console.warn("Failed to fetch election data:", error);
    }

    // Create headhunters leaderboard
    const headhunters = leaderboardData.players.map((p) => ({
      address: p.address,
      kills: p.killCount,
    }));

    return {
      blockHeight,
      agents,
      deadAgents,
      king,
      candidates,
      treasury,
      taxRate,
      activePlayers,
      events,
      headhunters,
    };
  } catch (error) {
    console.error("Failed to fetch game state:", error);
    throw error;
  }
}

// ── Hook ─────────────────────────────────────────────────

export function useGameEngine() {
  const [state, setState] = useState<GameState | null>(null);
  const [latestEvent, setLatestEvent] = useState<GameEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const previousEventsRef = useRef<Set<string>>(new Set());

  // Fetch game state on mount and poll every second
  const fetchData = useCallback(async () => {
    try {
      const newState = await fetchGameState();
      setState(newState);
      setError(null);

      // Detect new events since last fetch
      if (newState.events.length > 0) {
        const latestEventData = newState.events[0];
        if (!previousEventsRef.current.has(latestEventData.id)) {
          setLatestEvent(latestEventData);
          previousEventsRef.current.add(latestEventData.id);

          // Keep only recent event IDs in memory (last 100)
          if (previousEventsRef.current.size > 100) {
            const idsArray = Array.from(previousEventsRef.current);
            previousEventsRef.current = new Set(idsArray.slice(-100));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Poll every 1 second for updates
    const interval = setInterval(fetchData, 1000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Return loading state while fetching initial data
  if (!state && !error) {
    // Return a placeholder empty state
    return {
      state: {
        blockHeight: 0,
        agents: [],
        deadAgents: [],
        king: {
          address: "",
          term: 0,
          taxRate: 0,
          termStartBlock: 0,
          termEndBlock: 0,
          voterCount: 0,
        },
        candidates: [],
        treasury: 0,
        taxRate: 0,
        activePlayers: 0,
        events: [],
        headhunters: [],
      } as GameState,
      latestEvent: null,
      error: null,
    };
  }

  if (error && !state) {
    console.error("Game engine error:", error);
    // Return error state with empty data
    return {
      state: {
        blockHeight: 0,
        agents: [],
        deadAgents: [],
        king: {
          address: "",
          term: 0,
          taxRate: 0,
          termStartBlock: 0,
          termEndBlock: 0,
          voterCount: 0,
        },
        candidates: [],
        treasury: 0,
        taxRate: 0,
        activePlayers: 0,
        events: [],
        headhunters: [],
      } as GameState,
      latestEvent: null,
      error,
    };
  }

  return { state: state!, latestEvent, error };
}

// No more mock event generation - all events come from the indexer
