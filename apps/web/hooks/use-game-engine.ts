"use client";

import { useReducer, useEffect, useCallback, useRef } from "react";
import type {
  GameState,
  Agent,
  AgentStatus,
  Candidate,
  GameEvent,
  KingInfo,
  DeadAgent,
} from "@/lib/types";
import {
  AGENT_COUNT_MIN,
  AGENT_COUNT_MAX,
  INITIAL_KRILL_MIN,
  INITIAL_KRILL_MAX,
  STARTING_KRILL,
  DEFAULT_TAX_RATE,
  TAX_RATE_DENOMINATOR,
  TERM_LENGTH,
  DELINQUENCY_THRESHOLD,
  DELINQUENCY_BOUNTY_PCT,
} from "@/lib/constants";

// ── Helpers ──────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAddress(): string {
  const hex = "0123456789abcdef";
  let addr = "0x";
  for (let i = 0; i < 40; i++) addr += hex[randomInt(0, 15)];
  return addr;
}

function pickRandom<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

let eventCounter = 0;
function makeEvent(
  type: GameEvent["type"],
  block: number,
  data: Record<string, string | number>
): GameEvent {
  return {
    id: `evt-${++eventCounter}`,
    type,
    block,
    timestamp: Date.now(),
    data,
  };
}

function getAgentStatus(agent: Agent, blockHeight: number): AgentStatus {
  if (!agent.isActive) return "dead";
  if (agent.isDelinquent) return "delinquent";
  if (agent.isInsolvent) return "insolvent";
  const ratio = agent.effectiveBalance / STARTING_KRILL;
  if (ratio < 0.15) return "critical";
  if (ratio < 0.4) return "warning";
  return "safe";
}

// ── Initial state ────────────────────────────────────────

function createInitialState(): GameState {
  const agentCount = randomInt(AGENT_COUNT_MIN, AGENT_COUNT_MAX);
  const startBlock = randomInt(100_000, 200_000);

  const agents: Agent[] = [];
  for (let i = 0; i < agentCount; i++) {
    const balance = randomInt(INITIAL_KRILL_MIN, INITIAL_KRILL_MAX);
    const agent: Agent = {
      address: randomAddress(),
      krillBalance: balance,
      effectiveBalance: balance,
      lastTaxBlock: startBlock - randomInt(0, 100),
      joinedBlock: startBlock - randomInt(100, 5000),
      isActive: true,
      isInsolvent: false,
      isDelinquent: false,
      status: "safe",
      kills: 0,
      gridIndex: i,
    };
    agent.status = getAgentStatus(agent, startBlock);
    agents.push(agent);
  }

  // Pick initial king
  const kingAgent = agents[0];
  const king: KingInfo = {
    address: kingAgent.address,
    term: 1,
    taxRate: DEFAULT_TAX_RATE,
    termStartBlock: startBlock - randomInt(0, TERM_LENGTH / 2),
    termEndBlock: 0,
    voterCount: randomInt(3, 8),
  };
  king.termEndBlock = king.termStartBlock + TERM_LENGTH;

  // Pick 3-5 candidates for current term
  const candidateCount = randomInt(3, 5);
  const candidates: Candidate[] = [];
  for (let i = 1; i <= candidateCount && i < agents.length; i++) {
    candidates.push({
      address: agents[i].address,
      bribePerVote: randomInt(5, 50),
      campaignFunds: randomInt(500, 5000),
      voteCount: randomInt(0, 12),
    });
  }

  return {
    blockHeight: startBlock,
    agents,
    deadAgents: [],
    king,
    candidates,
    treasury: randomInt(50_000, 200_000),
    taxRate: DEFAULT_TAX_RATE,
    activePlayers: agentCount,
    events: [],
    headhunters: agents.map((a) => ({ address: a.address, kills: 0 })),
  };
}

// ── Reducer ──────────────────────────────────────────────

type Action =
  | { type: "TICK" }
  | { type: "EVENT"; event: GameEvent; stateUpdates?: Partial<GameState> };

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "TICK": {
      const newBlock = state.blockHeight + 1;
      const taxPerBlock = state.taxRate / TAX_RATE_DENOMINATOR;

      const updatedAgents = state.agents.map((agent) => {
        if (!agent.isActive) return agent;

        const blocksSinceTax = newBlock - agent.lastTaxBlock;
        const taxDrain = agent.krillBalance * taxPerBlock * 0.01; // scale down for visual
        const newBalance = Math.max(0, agent.krillBalance - taxDrain);
        const newEffective = Math.max(0, agent.effectiveBalance - taxDrain);
        const isInsolvent = newEffective <= 0;
        const isDelinquent =
          !isInsolvent && blocksSinceTax > DELINQUENCY_THRESHOLD;

        const updated: Agent = {
          ...agent,
          krillBalance: newBalance,
          effectiveBalance: newEffective,
          isInsolvent,
          isDelinquent,
          status: "safe",
        };
        updated.status = getAgentStatus(updated, newBlock);
        return updated;
      });

      // Accrue treasury yield
      const treasuryYield = state.activePlayers * 0.5;
      const newTreasury = state.treasury + treasuryYield;

      return {
        ...state,
        blockHeight: newBlock,
        agents: updatedAgents,
        treasury: newTreasury,
      };
    }

    case "EVENT": {
      const newEvents = [action.event, ...state.events].slice(0, 100);
      return {
        ...state,
        ...action.stateUpdates,
        events: newEvents,
      };
    }

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────

export function useGameEngine() {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const generateRandomEvent = useCallback(() => {
    const s = stateRef.current;
    const roll = Math.random();
    const activeAgents = s.agents.filter((a) => a.isActive);
    if (activeAgents.length === 0) return;

    // 60% nothing
    if (roll < 0.6) return;

    // 15% VoteCast
    if (roll < 0.75) {
      const voter = pickRandom(activeAgents);
      if (s.candidates.length === 0) return;
      const candidate = pickRandom(s.candidates);
      const updatedCandidates = s.candidates.map((c) =>
        c.address === candidate.address
          ? { ...c, voteCount: c.voteCount + 1 }
          : c
      );
      dispatch({
        type: "EVENT",
        event: makeEvent("VoteCast", s.blockHeight, {
          voter: voter.address,
          candidate: candidate.address,
          bribe: candidate.bribePerVote,
        }),
        stateUpdates: { candidates: updatedCandidates },
      });
      return;
    }

    // 5% PlayerPurged
    if (roll < 0.8) {
      const insolvents = activeAgents.filter(
        (a) => a.status === "insolvent" || a.status === "critical"
      );
      if (insolvents.length === 0) return;
      const victim = pickRandom(insolvents);
      const purger = pickRandom(
        activeAgents.filter((a) => a.address !== victim.address)
      );
      if (!purger) return;

      const deadAgent: DeadAgent = {
        address: victim.address,
        cause: "PURGED",
        krillAtDeath: victim.effectiveBalance,
        block: s.blockHeight,
        killedBy: purger.address,
      };

      const updatedAgents = s.agents.map((a) =>
        a.address === victim.address
          ? { ...a, isActive: false, status: "dead" as AgentStatus }
          : a
      );
      const updatedHunters = s.headhunters.map((h) =>
        h.address === purger.address ? { ...h, kills: h.kills + 1 } : h
      );
      // Also update the purger's kill count in agents
      const agentsWithKills = updatedAgents.map((a) =>
        a.address === purger.address ? { ...a, kills: a.kills + 1 } : a
      );

      dispatch({
        type: "EVENT",
        event: makeEvent("PlayerPurged", s.blockHeight, {
          player: victim.address,
          purger: purger.address,
          krillBalance: Math.round(victim.effectiveBalance),
        }),
        stateUpdates: {
          agents: agentsWithKills,
          deadAgents: [deadAgent, ...s.deadAgents],
          headhunters: updatedHunters,
          activePlayers: s.activePlayers - 1,
        },
      });
      return;
    }

    // 5% TaxRateChanged
    if (roll < 0.85) {
      const oldRate = s.taxRate;
      const change = randomInt(-50, 100);
      const newRate = Math.max(50, Math.min(1000, oldRate + change));
      dispatch({
        type: "EVENT",
        event: makeEvent("TaxRateChanged", s.blockHeight, {
          oldRate,
          newRate,
        }),
        stateUpdates: { taxRate: newRate },
      });
      return;
    }

    // 5% TreasuryDistribution
    if (roll < 0.9) {
      const recipient = pickRandom(activeAgents);
      const amount = randomInt(100, 2000);
      const updatedAgents = s.agents.map((a) =>
        a.address === recipient.address
          ? {
              ...a,
              krillBalance: a.krillBalance + amount,
              effectiveBalance: a.effectiveBalance + amount,
            }
          : a
      );
      dispatch({
        type: "EVENT",
        event: makeEvent("TreasuryDistribution", s.blockHeight, {
          to: recipient.address,
          amount,
        }),
        stateUpdates: {
          agents: updatedAgents,
          treasury: Math.max(0, s.treasury - amount),
        },
      });
      return;
    }

    // 3% DelinquentSettled
    if (roll < 0.93) {
      const delinquents = activeAgents.filter((a) => a.isDelinquent);
      if (delinquents.length === 0) return;
      const target = pickRandom(delinquents);
      const settler = pickRandom(
        activeAgents.filter((a) => a.address !== target.address)
      );
      if (!settler) return;
      const bounty = Math.round(
        target.effectiveBalance * (DELINQUENCY_BOUNTY_PCT / 100)
      );

      const deadAgent: DeadAgent = {
        address: target.address,
        cause: "DELINQUENT",
        krillAtDeath: target.effectiveBalance,
        block: s.blockHeight,
        killedBy: settler.address,
      };

      const updatedAgents = s.agents.map((a) => {
        if (a.address === target.address)
          return { ...a, isActive: false, status: "dead" as AgentStatus };
        if (a.address === settler.address)
          return {
            ...a,
            krillBalance: a.krillBalance + bounty,
            effectiveBalance: a.effectiveBalance + bounty,
            kills: a.kills + 1,
          };
        return a;
      });
      const updatedHunters = s.headhunters.map((h) =>
        h.address === settler.address ? { ...h, kills: h.kills + 1 } : h
      );

      dispatch({
        type: "EVENT",
        event: makeEvent("DelinquentSettled", s.blockHeight, {
          player: target.address,
          settler: settler.address,
          bounty,
        }),
        stateUpdates: {
          agents: updatedAgents,
          deadAgents: [deadAgent, ...s.deadAgents],
          headhunters: updatedHunters,
          activePlayers: s.activePlayers - 1,
        },
      });
      return;
    }

    // 3% PlayerEntered
    if (roll < 0.96) {
      const newAgent: Agent = {
        address: randomAddress(),
        krillBalance: STARTING_KRILL,
        effectiveBalance: STARTING_KRILL,
        lastTaxBlock: s.blockHeight,
        joinedBlock: s.blockHeight,
        isActive: true,
        isInsolvent: false,
        isDelinquent: false,
        status: "safe",
        kills: 0,
        gridIndex: s.agents.length,
      };
      dispatch({
        type: "EVENT",
        event: makeEvent("PlayerEntered", s.blockHeight, {
          player: newAgent.address,
          shellAmount: 1000,
          krillAmount: STARTING_KRILL,
        }),
        stateUpdates: {
          agents: [...s.agents, newAgent],
          headhunters: [
            ...s.headhunters,
            { address: newAgent.address, kills: 0 },
          ],
          activePlayers: s.activePlayers + 1,
        },
      });
      return;
    }

    // 2% CampaignStarted
    if (roll < 0.98) {
      const newCandidate = pickRandom(activeAgents);
      if (s.candidates.some((c) => c.address === newCandidate.address)) return;
      const bribe = randomInt(5, 50);
      dispatch({
        type: "EVENT",
        event: makeEvent("CampaignStarted", s.blockHeight, {
          candidate: newCandidate.address,
          bribePerVote: bribe,
        }),
        stateUpdates: {
          candidates: [
            ...s.candidates,
            {
              address: newCandidate.address,
              bribePerVote: bribe,
              campaignFunds: randomInt(500, 3000),
              voteCount: 0,
            },
          ],
        },
      });
      return;
    }

    // 2% BribePerVoteUpdated
    if (s.candidates.length === 0) return;
    const candidate = pickRandom(s.candidates);
    const oldBribe = candidate.bribePerVote;
    const newBribe = Math.max(1, oldBribe + randomInt(-10, 20));
    const updatedCandidates = s.candidates.map((c) =>
      c.address === candidate.address ? { ...c, bribePerVote: newBribe } : c
    );
    dispatch({
      type: "EVENT",
      event: makeEvent("BribePerVoteUpdated", s.blockHeight, {
        candidate: candidate.address,
        oldBribe,
        newBribe,
      }),
      stateUpdates: { candidates: updatedCandidates },
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "TICK" });
      generateRandomEvent();
    }, 1000);
    return () => clearInterval(interval);
  }, [generateRandomEvent]);

  const latestEvent = state.events[0] ?? null;

  return { state, latestEvent };
}
