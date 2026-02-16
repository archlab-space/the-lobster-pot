import type { Address, Hash } from "viem";

export interface TxResult {
  hash: Hash;
  blockNumber: bigint;
}

export interface PlayerData {
  address: Address;
  krillBalance: bigint;
  effectiveBalance: bigint;
  isActive: boolean;
  isInsolvent: boolean;
  isDelinquent: boolean;
  pendingReward: bigint;
  pendingVoterReward: bigint;
  lastTaxBlock: bigint;
  joinedBlock: bigint;
  entryCount: number;
}

export interface CandidateData {
  address: Address;
  bribePerVote: bigint;
  campaignFunds: bigint;
  voteCount: bigint;
  registered: boolean;
}

export interface GameSnapshot {
  king: Address;
  treasury: bigint;
  effectiveTreasury: bigint;
  activePlayers: bigint;
  taxRate: bigint;
  currentTerm: bigint;
  blocksRemainingInTerm: bigint;
}

export interface AgentStatus {
  address: Address;
  shellBalance: bigint;
  player: PlayerData;
  game: GameSnapshot;
}

export interface ElectionSnapshot {
  currentTerm: bigint;
  currentKing: Address;
  currentKingVoterCount: bigint;
  blocksRemainingInTerm: bigint;
  candidates: CandidateData[];
  hasVoted: boolean;
  votedFor: Address;
  leadingCandidate: Address;
  leadingVoteCount: bigint;
}
