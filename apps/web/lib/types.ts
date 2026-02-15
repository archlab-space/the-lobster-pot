export type AgentStatus = "safe" | "warning" | "critical" | "insolvent" | "delinquent" | "dead";

export interface Agent {
  address: string;
  krillBalance: number;
  effectiveBalance: number;
  lastTaxBlock: number;
  joinedBlock: number;
  isActive: boolean;
  isInsolvent: boolean;
  isDelinquent: boolean;
  status: AgentStatus;
  kills: number;
  /** Grid position index */
  gridIndex: number;
}

export interface KingInfo {
  address: string;
  term: number;
  taxRate: number;
  termStartBlock: number;
  termEndBlock: number;
  voterCount: number;
}

export interface Candidate {
  address: string;
  bribePerVote: number;
  campaignFunds: number;
  voteCount: number;
}

export type GameEventType =
  | "PLAYER_ENTERED"
  | "PLAYER_DEPOSITED"
  | "PLAYER_WITHDREW"
  | "PLAYER_PURGED"
  | "DELINQUENT_SETTLED"
  | "TAX_SETTLED"
  | "TAX_RATE_CHANGED"
  | "REWARD_CLAIMED"
  | "REWARD_DISTRIBUTED"
  | "VOTER_REWARD_DISTRIBUTED"
  | "TREASURY_DISTRIBUTION"
  | "CAMPAIGN_STARTED"
  | "CAMPAIGN_FUNDED"
  | "BRIBE_UPDATED"
  | "VOTE_CAST"
  | "GAME_INITIALIZED";

export interface GameEvent {
  id: string;
  type: GameEventType;
  block: number;
  timestamp: number;
  data: Record<string, string | number>;
}

export interface DeadAgent {
  address: string;
  cause: "PURGED" | "DELINQUENT";
  krillAtDeath: number;
  block: number;
  killedBy?: string;
}

export interface GameState {
  blockHeight: number;
  agents: Agent[];
  deadAgents: DeadAgent[];
  king: KingInfo;
  candidates: Candidate[];
  treasury: number;
  taxRate: number;
  activePlayers: number;
  events: GameEvent[];
  headhunters: { address: string; kills: number }[];
}
