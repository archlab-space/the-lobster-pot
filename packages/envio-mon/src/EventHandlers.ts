/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  Election,
  Election_BribePerVoteUpdated,
  Election_CampaignFunded,
  Election_CampaignFundsReclaimed,
  Election_CampaignStarted,
  Election_VoteCast,
  GameCore,
  GameCore_DelinquentSettled,
  GameCore_GameInitialized,
  GameCore_KrillCredited,
  GameCore_KrillDeducted,
  GameCore_Paused,
  GameCore_PlayerDeactivated,
  GameCore_PlayerDeposited,
  GameCore_PlayerEntered,
  GameCore_PlayerPurged,
  GameCore_PlayerWithdrew,
  GameCore_RewardClaimed,
  GameCore_RewardDistributed,
  GameCore_TaxRateChanged,
  GameCore_TaxSettled,
  GameCore_TreasuryCredited,
  GameCore_TreasuryDistribution,
  GameCore_Unpaused,
  GameCore_VoterRewardDistributed,
  GlobalState,
  Player,
  PlayerStatus,
  Term,
  Campaign,
  Vote,
  Death,
  DeathCause,
  ActivityEvent,
  EventType,
} from "generated";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate effective balance (balance - pending tax)
 * Uses piecewise calculation if tax rate changed during idle period
 */
function calculateEffectiveBalance(
  krillBalance: bigint,
  lastTaxBlock: bigint,
  currentBlock: bigint,
  previousTaxRate: bigint,
  currentTaxRate: bigint,
  taxRateChangeBlock: bigint
): bigint {
  let pendingTax = 0n;

  // Piecewise calculation if tax changed during idle period
  if (taxRateChangeBlock > lastTaxBlock && taxRateChangeBlock <= currentBlock) {
    const blocksBefore = taxRateChangeBlock - lastTaxBlock;
    const blocksAfter = currentBlock - taxRateChangeBlock;
    pendingTax = (blocksBefore * previousTaxRate) + (blocksAfter * currentTaxRate);
  } else {
    // Single rate applies to entire period
    pendingTax = (currentBlock - lastTaxBlock) * currentTaxRate;
  }

  return krillBalance > pendingTax ? krillBalance - pendingTax : 0n;
}

/**
 * Determine player status based on effective balance and state
 */
function calculatePlayerStatus(
  effectiveBalance: bigint,
  isActive: boolean,
  isDelinquent: boolean,
  isInsolvent: boolean
): PlayerStatus {
  if (!isActive) return "DEAD";
  if (isDelinquent) return "DELINQUENT";
  if (isInsolvent) return "INSOLVENT";

  const KRILL = BigInt(1e18);

  // Absolute thresholds based on game economics:
  // Min entry = 30k SHELL = 3M KRILL, so use fixed KRILL thresholds
  if (effectiveBalance < 450_000n * KRILL) return "CRITICAL";  // ~15% of min entry
  if (effectiveBalance < 1_200_000n * KRILL) return "WARNING";  // ~40% of min entry
  return "SAFE";
}

/**
 * Check if player is delinquent (>18k blocks since last tax settlement)
 */
function isDelinquent(lastTaxBlock: bigint, currentBlock: bigint): boolean {
  const DELINQUENCY_THRESHOLD = 18_000n;
  return (currentBlock - lastTaxBlock) > DELINQUENCY_THRESHOLD;
}

/**
 * Get or create singleton GlobalState entity
 */
async function getOrCreateGlobalState(
  context: any,
): Promise<Mutable<GlobalState>> {
  let global = await context.GlobalState.get("GLOBAL") as Mutable<GlobalState> | undefined;
  if (!global) {
    global = {
      id: "GLOBAL",
      treasury: 0n,
      taxRate: BigInt(1e18), // MIN_TAX_RATE = 1 KRILL/block
      previousTaxRate: BigInt(1e18),
      taxRateChangeBlock: 0n,
      activePlayers: 0,
      totalEntries: 0,
      currentBlock: 0n,
      currentKing: "",
      currentTerm: 0n,
      termStartBlock: 0n,
      termEndBlock: 0n,
      totalYieldEmitted: 0n,
      lastYieldUpdateBlock: 0n,
      gameStartBlock: 0n,
      electionContract: "",
      lastUpdatedAt: 0n,
      lastUpdatedBlock: 0n,
      isPaused: false,
    };
  }
  return global;
}

/**
 * Get or create Player entity
 */
async function getOrCreatePlayer(
  context: any,
  chainId: number,
  address: string,
  block: bigint,
  timestamp: bigint
): Promise<Mutable<Player>> {
  const id = `${chainId}_${address}`;
  let player = await context.Player.get(id) as Mutable<Player> | undefined;
  if (!player) {
    player = {
      id,
      address,
      krillBalance: 0n,
      lastTaxBlock: block,
      joinedBlock: block,
      entryCount: 0,
      isActive: false,
      effectiveBalance: 0n,
      status: "DEAD",
      isDelinquent: false,
      isInsolvent: false,
      killCount: 0,
      totalBountyEarned: 0n,
      firstEntryBlock: block,
      lastActivityBlock: block,
      totalDeposited: 0n,
      totalWithdrawn: 0n,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
  return player;
}

/**
 * Update player computed fields based on current state
 */
function updatePlayerComputedFields(
  player: Mutable<Player>,
  globalState: GlobalState,
  currentBlock: bigint,
  timestamp: bigint
): void {
  player.effectiveBalance = calculateEffectiveBalance(
    player.krillBalance,
    player.lastTaxBlock,
    currentBlock,
    globalState.previousTaxRate,
    globalState.taxRate,
    globalState.taxRateChangeBlock
  );
  player.isDelinquent = isDelinquent(player.lastTaxBlock, currentBlock);
  player.isInsolvent = player.krillBalance < (1_000n * BigInt(1e18));
  player.status = calculatePlayerStatus(
    player.effectiveBalance,
    player.isActive,
    player.isDelinquent,
    player.isInsolvent
  );
  player.lastActivityBlock = currentBlock;
  player.updatedAt = timestamp;
}

/**
 * Get or create Term entity
 */
async function getOrCreateTerm(
  context: any,
  chainId: number,
  termNumber: bigint,
  gameStartBlock: bigint = 0n
): Promise<Mutable<Term>> {
  const id = `${chainId}_${termNumber}`;
  let term = await context.Term.get(id) as Mutable<Term> | undefined;
  if (!term) {
    const TERM_DURATION = 72_000n;
    term = {
      id,
      termNumber,
      startBlock: gameStartBlock + termNumber * TERM_DURATION,
      endBlock: gameStartBlock + (termNumber + 1n) * TERM_DURATION,
      king: undefined,
      kingVoteCount: 0,
      totalCandidates: 0,
      totalVotes: 0,
      totalBribes: 0n,
    };
  }
  return term;
}

/**
 * Create ActivityEvent for news ticker
 */
function createActivityEvent(
  chainId: number,
  block: bigint,
  logIndex: number,
  timestamp: bigint,
  txHash: string,
  eventType: EventType,
  data: object,
  primaryAddress?: string,
  secondaryAddress?: string,
  amount?: bigint
): ActivityEvent {
  return {
    id: `${chainId}_${block}_${logIndex}`,
    eventType,
    block,
    timestamp,
    transactionHash: txHash,
    data: JSON.stringify(data),
    primaryAddress: primaryAddress || undefined,
    secondaryAddress: secondaryAddress || undefined,
    amount: amount || undefined,
  };
}

// ============================================
// Event Handlers
// ============================================

Election.BribePerVoteUpdated.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: Election_BribePerVoteUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    candidate: event.params.candidate,
    oldBribe: event.params.oldBribe,
    newBribe: event.params.newBribe,
  };
  context.Election_BribePerVoteUpdated.set(entity);

  // Update Campaign bribe rate
  const campaignId = `${event.chainId}_${event.params.term}_${event.params.candidate}`;
  const campaign = await context.Campaign.get(campaignId) as Mutable<Campaign> | undefined;
  if (campaign) {
    campaign.bribePerVote = event.params.newBribe;
    campaign.updatedAt = BigInt(event.block.timestamp);
    context.Campaign.set(campaign);
  }

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "BRIBE_UPDATED",
    {
      candidate: event.params.candidate,
      term: event.params.term.toString(),
      oldBribe: event.params.oldBribe.toString(),
      newBribe: event.params.newBribe.toString(),
    },
    event.params.candidate,
    undefined,
    event.params.newBribe
  );
  context.ActivityEvent.set(activityEvent);
});

Election.CampaignFunded.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: Election_CampaignFunded = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    candidate: event.params.candidate,
    amount: event.params.amount,
  };
  context.Election_CampaignFunded.set(entity);

  // Update Campaign funds
  const campaignId = `${event.chainId}_${event.params.term}_${event.params.candidate}`;
  const campaign = await context.Campaign.get(campaignId) as Mutable<Campaign> | undefined;
  if (campaign) {
    campaign.campaignFunds += event.params.amount;
    campaign.updatedAt = BigInt(event.block.timestamp);
    context.Campaign.set(campaign);
  }

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "CAMPAIGN_FUNDED",
    {
      candidate: event.params.candidate,
      term: event.params.term.toString(),
      amount: event.params.amount.toString(),
    },
    event.params.candidate,
    undefined,
    event.params.amount
  );
  context.ActivityEvent.set(activityEvent);
});

Election.CampaignFundsReclaimed.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: Election_CampaignFundsReclaimed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    candidate: event.params.candidate,
    amount: event.params.amount,
  };
  context.Election_CampaignFundsReclaimed.set(entity);

  // Update Campaign funds
  const campaignId = `${event.chainId}_${event.params.term}_${event.params.candidate}`;
  const campaign = await context.Campaign.get(campaignId) as Mutable<Campaign> | undefined;
  if (campaign) {
    campaign.campaignFunds -= event.params.amount;
    campaign.updatedAt = BigInt(event.block.timestamp);
    context.Campaign.set(campaign);
  }
});

Election.CampaignStarted.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: Election_CampaignStarted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    candidate: event.params.candidate,
    bribePerVote: event.params.bribePerVote,
  };
  context.Election_CampaignStarted.set(entity);

  // Get/create Term
  const globalState = await getOrCreateGlobalState(context);
  const term = await getOrCreateTerm(context, event.chainId, event.params.term, globalState.gameStartBlock);

  // Get/create Campaign
  const campaignId = `${event.chainId}_${event.params.term}_${event.params.candidate}`;
  let campaign = await context.Campaign.get(campaignId) as Mutable<Campaign> | undefined;

  if (!campaign) {
    const candidate = await getOrCreatePlayer(
      context,
      event.chainId,
      event.params.candidate,
      BigInt(event.block.number),
      BigInt(event.block.timestamp)
    );
    term.totalCandidates += 1;
    context.Term.set(term);

    campaign = {
      id: campaignId,
      term_id: term.id,
      candidate_id: candidate.id,
      bribePerVote: event.params.bribePerVote,
      campaignFunds: 0n,
      voteCount: 0,
      totalBribesPaid: 0n,
      isLeading: false,
      isWinner: false,
      createdAt: BigInt(event.block.timestamp),
      updatedAt: BigInt(event.block.timestamp),
    };
  } else {
    campaign.bribePerVote = event.params.bribePerVote;
    campaign.updatedAt = BigInt(event.block.timestamp);
  }

  context.Campaign.set(campaign);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "CAMPAIGN_STARTED",
    {
      candidate: event.params.candidate,
      term: event.params.term.toString(),
      bribePerVote: event.params.bribePerVote.toString(),
    },
    event.params.candidate,
    undefined,
    event.params.bribePerVote
  );
  context.ActivityEvent.set(activityEvent);
});

Election.VoteCast.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: Election_VoteCast = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    voter: event.params.voter,
    candidate: event.params.candidate,
    bribe: event.params.bribe,
  };
  context.Election_VoteCast.set(entity);

  // Get/create Term
  const globalState = await getOrCreateGlobalState(context);
  const term = await getOrCreateTerm(context, event.chainId, event.params.term, globalState.gameStartBlock);
  term.totalVotes += 1;
  term.totalBribes += event.params.bribe;

  // Get/create Campaign
  const campaignId = `${event.chainId}_${event.params.term}_${event.params.candidate}`;
  let campaign = await context.Campaign.get(campaignId) as Mutable<Campaign> | undefined;
  if (!campaign) {
    const candidate = await getOrCreatePlayer(
      context,
      event.chainId,
      event.params.candidate,
      BigInt(event.block.number),
      BigInt(event.block.timestamp)
    );
    term.totalCandidates += 1;

    campaign = {
      id: campaignId,
      term_id: term.id,
      candidate_id: candidate.id,
      bribePerVote: 0n, // Will be set by CampaignStarted event
      campaignFunds: 0n,
      voteCount: 0,
      totalBribesPaid: 0n,
      isLeading: false,
      isWinner: false,
      createdAt: BigInt(event.block.timestamp),
      updatedAt: BigInt(event.block.timestamp),
    };
  }

  campaign.voteCount += 1;
  campaign.totalBribesPaid += event.params.bribe;
  campaign.campaignFunds -= event.params.bribe; // Subtract bribe from remaining funds
  campaign.updatedAt = BigInt(event.block.timestamp);

  // Check if this campaign is now leading
  const termCampaigns = await context.Campaign.getWhere.term_id.eq(term.id);

  // Include current campaign if newly created (not yet persisted via .set())
  const allCampaigns: typeof termCampaigns = termCampaigns.some((c: Campaign) => c.id === campaign!.id)
    ? termCampaigns
    : [...termCampaigns, campaign];

  // Find the campaign with most votes
  let maxVotes = 0;
  let leadingCampaignId: string | null = null;
  for (const c of allCampaigns) {
    const votes = c.id === campaign.id ? campaign.voteCount : c.voteCount;
    if (votes > maxVotes) {
      maxVotes = votes;
      leadingCampaignId = c.id;
    }
  }

  // Reset all isLeading flags and set the new leader
  for (const c of allCampaigns) {
    const newIsLeading = c.id === leadingCampaignId;
    if (c.id === campaign.id) {
      campaign.isLeading = newIsLeading;
    } else if (c.isLeading !== newIsLeading) {
      (c as Mutable<Campaign>).isLeading = newIsLeading;
      context.Campaign.set(c);
    }
  }

  // Save updated entities
  context.Campaign.set(campaign);
  context.Term.set(term);

  // Create Vote entity
  const voter = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.voter,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  const vote: Vote = {
    id: `${event.chainId}_${event.params.term}_${event.params.voter}`,
    term_id: term.id,
    voter_id: voter.id,
    campaign_id: campaign.id,
    bribeReceived: event.params.bribe,
    votedAt: BigInt(event.block.number),
    votedAtTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  };
  context.Vote.set(vote);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "VOTE_CAST",
    {
      voter: event.params.voter,
      candidate: event.params.candidate,
      term: event.params.term.toString(),
      bribe: event.params.bribe.toString(),
    },
    event.params.voter,
    event.params.candidate,
    event.params.bribe
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.DelinquentSettled.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_DelinquentSettled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    settler: event.params.settler,
    remainingKrill: event.params.remainingKrill,
    settlerKrillBalance: event.params.settlerKrillBalance,
    treasury: event.params.treasury,
  };
  context.GameCore_DelinquentSettled.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);

  // Update victim Player
  const victim = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  const krillAtDeath = victim.krillBalance;
  victim.krillBalance = event.params.remainingKrill;
  victim.lastTaxBlock = BigInt(event.block.number); // Tax was settled

  // If player has 0 balance after settlement, they're dead
  // Note: PlayerDeactivated event (emitted before this) already handles
  // setting isActive=false and the correct activePlayers count
  const isDead = event.params.remainingKrill === 0n;

  updatePlayerComputedFields(victim, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(victim);
  context.GlobalState.set(globalState);

  // Update settler Player
  const settler = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.settler,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  const bounty = event.params.settlerKrillBalance - settler.krillBalance;
  settler.krillBalance = event.params.settlerKrillBalance;
  if (isDead) {
    settler.killCount += 1;
  }
  settler.totalBountyEarned += bounty;
  updatePlayerComputedFields(settler, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(settler);

  // Create Death entity if player died
  if (isDead) {
    const death: Death = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      victim_id: victim.id,
      killer_id: settler.id,
      cause: "DELINQUENT",
      krillAtDeath,
      bountyEarned: bounty,
      block: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      transactionHash: event.transaction.hash,
    };
    context.Death.set(death);
  }

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "DELINQUENT_SETTLED",
    {
      player: event.params.player,
      settler: event.params.settler,
      remainingKrill: event.params.remainingKrill.toString(),
      bounty: bounty.toString(),
      died: isDead,
    },
    event.params.player,
    event.params.settler,
    bounty
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.GameInitialized.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_GameInitialized = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    election: event.params.election,
    startBlock: event.params.startBlock,
  };
  context.GameCore_GameInitialized.set(entity);

  // Initialize GlobalState singleton
  const globalState = await getOrCreateGlobalState(context);
  globalState.electionContract = event.params.election;
  globalState.gameStartBlock = event.params.startBlock;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  globalState.taxRateChangeBlock = event.params.startBlock;
  context.GlobalState.set(globalState);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "GAME_INITIALIZED",
    { election: event.params.election, startBlock: event.params.startBlock.toString() }
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.KrillCredited.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_KrillCredited = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    amount: event.params.amount,
    krillBalance: event.params.krillBalance,
  };
  context.GameCore_KrillCredited.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Update Player (credits don't update lastTaxBlock)
  const player = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  player.krillBalance = event.params.krillBalance;
  updatePlayerComputedFields(player, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(player);
});

GameCore.KrillDeducted.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_KrillDeducted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    amount: event.params.amount,
    remainingKrill: event.params.remainingKrill,
  };
  context.GameCore_KrillDeducted.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Update Player
  const player = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  player.krillBalance = event.params.remainingKrill;
  updatePlayerComputedFields(player, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(player);
});

GameCore.Paused.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_Paused = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    account: event.params.account,
  };
  context.GameCore_Paused.set(entity);

  // Update GlobalState timestamp
  const globalState = await getOrCreateGlobalState(context);
  globalState.isPaused = true;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);
});

GameCore.PlayerDeactivated.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_PlayerDeactivated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    activePlayers: event.params.activePlayers,
  };
  context.GameCore_PlayerDeactivated.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.activePlayers = Number(event.params.activePlayers);
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Update Player
  const player = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  player.isActive = false;
  updatePlayerComputedFields(player, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(player);
});

GameCore.PlayerDeposited.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_PlayerDeposited = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    shellAmount: event.params.shellAmount,
    krillBalance: event.params.krillBalance,
  };
  context.GameCore_PlayerDeposited.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Update Player
  const player = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  player.krillBalance = event.params.krillBalance;
  player.totalDeposited += event.params.shellAmount;
  updatePlayerComputedFields(player, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(player);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "PLAYER_DEPOSITED",
    {
      player: event.params.player,
      shellAmount: event.params.shellAmount.toString(),
      krillBalance: event.params.krillBalance.toString(),
    },
    event.params.player,
    undefined,
    event.params.shellAmount
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.PlayerEntered.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_PlayerEntered = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    shellAmount: event.params.shellAmount,
    krillBalance: event.params.krillBalance,
    entryCount: event.params.entryCount,
    treasury: event.params.treasury,
    activePlayers: event.params.activePlayers,
  };
  context.GameCore_PlayerEntered.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.activePlayers = Number(event.params.activePlayers);
  globalState.totalEntries += 1;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Create/update Player
  const player = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );

  // Set first entry block if this is the first time
  if (player.entryCount === 0) {
    player.firstEntryBlock = BigInt(event.block.number);
  }

  player.isActive = true;
  player.krillBalance = event.params.krillBalance;
  player.lastTaxBlock = BigInt(event.block.number);
  player.joinedBlock = BigInt(event.block.number);
  player.entryCount = Number(event.params.entryCount);
  player.totalDeposited += event.params.shellAmount;

  updatePlayerComputedFields(player, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(player);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "PLAYER_ENTERED",
    {
      player: event.params.player,
      shellAmount: event.params.shellAmount.toString(),
      krillBalance: event.params.krillBalance.toString(),
      entryCount: event.params.entryCount.toString(),
    },
    event.params.player,
    undefined,
    event.params.shellAmount
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.PlayerPurged.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_PlayerPurged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    purger: event.params.purger,
    purgerKrillBalance: event.params.purgerKrillBalance,
    treasury: event.params.treasury,
  };
  context.GameCore_PlayerPurged.set(entity);

  // Update GlobalState
  // Note: PlayerDeactivated event (emitted before this) already handles
  // the correct activePlayers count, so we don't decrement here
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Update victim Player
  const victim = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  const krillAtDeath = victim.krillBalance;
  victim.isActive = false; // Redundant with PlayerDeactivated but safe
  victim.krillBalance = 0n;
  updatePlayerComputedFields(victim, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(victim);

  // Update killer Player
  const killer = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.purger,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  const bounty = event.params.purgerKrillBalance - killer.krillBalance;
  killer.krillBalance = event.params.purgerKrillBalance;
  killer.killCount += 1;
  killer.totalBountyEarned += bounty;
  updatePlayerComputedFields(killer, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(killer);

  // Create Death entity
  const death: Death = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    victim_id: victim.id,
    killer_id: killer.id,
    cause: "PURGED",
    krillAtDeath,
    bountyEarned: bounty,
    block: BigInt(event.block.number),
    timestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  };
  context.Death.set(death);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "PLAYER_PURGED",
    {
      victim: event.params.player,
      killer: event.params.purger,
      bounty: bounty.toString(),
    },
    event.params.player,
    event.params.purger,
    bounty
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.PlayerWithdrew.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_PlayerWithdrew = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    remainingKrill: event.params.remainingKrill,
    shellReceived: event.params.shellReceived,
    treasury: event.params.treasury,
  };
  context.GameCore_PlayerWithdrew.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Update Player
  const player = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  player.krillBalance = event.params.remainingKrill;
  player.totalWithdrawn += event.params.shellReceived;
  updatePlayerComputedFields(player, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(player);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "PLAYER_WITHDREW",
    {
      player: event.params.player,
      shellReceived: event.params.shellReceived.toString(),
      remainingKrill: event.params.remainingKrill.toString(),
    },
    event.params.player,
    undefined,
    event.params.shellReceived
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.RewardClaimed.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_RewardClaimed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    claimedAmount: event.params.claimedAmount,
    krillBalance: event.params.krillBalance,
    treasury: event.params.treasury,
  };
  context.GameCore_RewardClaimed.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Update Player (rewards update balance but NOT lastTaxBlock)
  const player = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  player.krillBalance = event.params.krillBalance;
  updatePlayerComputedFields(player, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(player);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "REWARD_CLAIMED",
    {
      player: event.params.player,
      claimedAmount: event.params.claimedAmount.toString(),
      krillBalance: event.params.krillBalance.toString(),
    },
    event.params.player,
    undefined,
    event.params.claimedAmount
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.RewardDistributed.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_RewardDistributed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    amount: event.params.amount,
    perPlayer: event.params.perPlayer,
    currentTerm: event.params.currentTerm,
    currentKing: event.params.currentKing,
    treasury: event.params.treasury,
  };
  context.GameCore_RewardDistributed.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.currentKing = event.params.currentKing;
  globalState.currentTerm = event.params.currentTerm;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "REWARD_DISTRIBUTED",
    {
      amount: event.params.amount.toString(),
      perPlayer: event.params.perPlayer.toString(),
      currentKing: event.params.currentKing,
      currentTerm: event.params.currentTerm.toString(),
    },
    event.params.currentKing,
    undefined,
    event.params.amount
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.TaxRateChanged.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_TaxRateChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    oldRate: event.params.oldRate,
    newRate: event.params.newRate,
    currentTerm: event.params.currentTerm,
    currentKing: event.params.currentKing,
    treasury: event.params.treasury,
  };
  context.GameCore_TaxRateChanged.set(entity);

  // Update GlobalState with new tax rate and king info
  const globalState = await getOrCreateGlobalState(context);
  const previousTerm = globalState.currentTerm;

  globalState.previousTaxRate = event.params.oldRate;
  globalState.taxRate = event.params.newRate;
  globalState.taxRateChangeBlock = BigInt(event.block.number);
  globalState.treasury = event.params.treasury;
  globalState.currentKing = event.params.currentKing;
  globalState.currentTerm = event.params.currentTerm;

  // Update term boundaries (offset by gameStartBlock)
  const TERM_DURATION = 72_000n;
  globalState.termStartBlock = globalState.gameStartBlock + event.params.currentTerm * TERM_DURATION;
  globalState.termEndBlock = globalState.gameStartBlock + (event.params.currentTerm + 1n) * TERM_DURATION;

  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Detect term change: finalize the previous term's king and winner
  if (event.params.currentTerm > previousTerm && previousTerm > 0n) {
    const prevTermId = `${event.chainId}_${previousTerm}`;
    const prevTerm = await context.Term.get(prevTermId) as Mutable<Term> | undefined;
    if (prevTerm) {
      prevTerm.king = event.params.currentKing;
      context.Term.set(prevTerm);

      // Mark the leading campaign as the winner
      const prevCampaigns = await context.Campaign.getWhere.term_id.eq(prevTermId);
      let maxVotes = 0;
      let winnerCampaign: Mutable<Campaign> | null = null;
      for (const c of prevCampaigns) {
        if (c.voteCount > maxVotes) {
          maxVotes = c.voteCount;
          winnerCampaign = c as Mutable<Campaign>;
        }
      }
      if (winnerCampaign) {
        winnerCampaign.isWinner = true;
        prevTerm.kingVoteCount = winnerCampaign.voteCount;
        context.Campaign.set(winnerCampaign);
        context.Term.set(prevTerm);
      }
    }
  }

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "TAX_RATE_CHANGED",
    {
      oldRate: event.params.oldRate.toString(),
      newRate: event.params.newRate.toString(),
      currentKing: event.params.currentKing,
      currentTerm: event.params.currentTerm.toString(),
    },
    event.params.currentKing,
    undefined,
    event.params.newRate
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.TaxSettled.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_TaxSettled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    taxPaid: event.params.taxPaid,
    remainingKrill: event.params.remainingKrill,
    treasury: event.params.treasury,
  };
  context.GameCore_TaxSettled.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Update Player
  const player = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.player,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  player.krillBalance = event.params.remainingKrill;
  player.lastTaxBlock = BigInt(event.block.number); // Tax was settled
  updatePlayerComputedFields(player, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(player);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "TAX_SETTLED",
    {
      player: event.params.player,
      taxPaid: event.params.taxPaid.toString(),
      remainingKrill: event.params.remainingKrill.toString(),
    },
    event.params.player,
    undefined,
    event.params.taxPaid
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.TreasuryCredited.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_TreasuryCredited = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    amount: event.params.amount,
    treasury: event.params.treasury,
  };
  context.GameCore_TreasuryCredited.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.totalYieldEmitted += event.params.amount;
  globalState.lastYieldUpdateBlock = BigInt(event.block.number);
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);
});

GameCore.TreasuryDistribution.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_TreasuryDistribution = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    to: event.params.to,
    amount: event.params.amount,
    recipientKrillBalance: event.params.recipientKrillBalance,
    currentTerm: event.params.currentTerm,
    currentKing: event.params.currentKing,
    treasury: event.params.treasury,
  };
  context.GameCore_TreasuryDistribution.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.currentKing = event.params.currentKing;
  globalState.currentTerm = event.params.currentTerm;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Update recipient Player
  const recipient = await getOrCreatePlayer(
    context,
    event.chainId,
    event.params.to,
    BigInt(event.block.number),
    BigInt(event.block.timestamp)
  );
  recipient.krillBalance = event.params.recipientKrillBalance;
  updatePlayerComputedFields(recipient, globalState, BigInt(event.block.number), BigInt(event.block.timestamp));
  context.Player.set(recipient);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "TREASURY_DISTRIBUTION",
    {
      to: event.params.to,
      amount: event.params.amount.toString(),
      currentKing: event.params.currentKing,
      currentTerm: event.params.currentTerm.toString(),
    },
    event.params.to,
    event.params.currentKing,
    event.params.amount
  );
  context.ActivityEvent.set(activityEvent);
});

GameCore.Unpaused.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_Unpaused = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    account: event.params.account,
  };
  context.GameCore_Unpaused.set(entity);

  // Update GlobalState timestamp
  const globalState = await getOrCreateGlobalState(context);
  globalState.isPaused = false;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);
});

GameCore.VoterRewardDistributed.handler(async ({ event, context }) => {
  // Create raw event entity
  const entity: GameCore_VoterRewardDistributed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    amount: event.params.amount,
    perVoter: event.params.perVoter,
    currentTerm: event.params.currentTerm,
    currentKing: event.params.currentKing,
    treasury: event.params.treasury,
  };
  context.GameCore_VoterRewardDistributed.set(entity);

  // Update GlobalState
  const globalState = await getOrCreateGlobalState(context);
  globalState.treasury = event.params.treasury;
  globalState.currentKing = event.params.currentKing;
  globalState.currentTerm = event.params.currentTerm;
  globalState.currentBlock = BigInt(event.block.number);
  globalState.lastUpdatedAt = BigInt(event.block.timestamp);
  globalState.lastUpdatedBlock = BigInt(event.block.number);
  context.GlobalState.set(globalState);

  // Create ActivityEvent
  const activityEvent = createActivityEvent(
    event.chainId,
    BigInt(event.block.number),
    event.logIndex,
    BigInt(event.block.timestamp),
    event.transaction.hash,
    "VOTER_REWARD_DISTRIBUTED",
    {
      amount: event.params.amount.toString(),
      perVoter: event.params.perVoter.toString(),
      currentKing: event.params.currentKing,
      currentTerm: event.params.currentTerm.toString(),
    },
    event.params.currentKing,
    undefined,
    event.params.amount
  );
  context.ActivityEvent.set(activityEvent);
});
