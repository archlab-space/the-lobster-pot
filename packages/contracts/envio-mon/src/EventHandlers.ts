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
} from "generated";

Election.BribePerVoteUpdated.handler(async ({ event, context }) => {
  const entity: Election_BribePerVoteUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    candidate: event.params.candidate,
    oldBribe: event.params.oldBribe,
    newBribe: event.params.newBribe,
  };

  context.Election_BribePerVoteUpdated.set(entity);
});

Election.CampaignFunded.handler(async ({ event, context }) => {
  const entity: Election_CampaignFunded = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    candidate: event.params.candidate,
    amount: event.params.amount,
  };

  context.Election_CampaignFunded.set(entity);
});

Election.CampaignFundsReclaimed.handler(async ({ event, context }) => {
  const entity: Election_CampaignFundsReclaimed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    candidate: event.params.candidate,
    amount: event.params.amount,
  };

  context.Election_CampaignFundsReclaimed.set(entity);
});

Election.CampaignStarted.handler(async ({ event, context }) => {
  const entity: Election_CampaignStarted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    candidate: event.params.candidate,
    bribePerVote: event.params.bribePerVote,
  };

  context.Election_CampaignStarted.set(entity);
});

Election.VoteCast.handler(async ({ event, context }) => {
  const entity: Election_VoteCast = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    term: event.params.term,
    voter: event.params.voter,
    candidate: event.params.candidate,
    bribe: event.params.bribe,
  };

  context.Election_VoteCast.set(entity);
});

GameCore.DelinquentSettled.handler(async ({ event, context }) => {
  const entity: GameCore_DelinquentSettled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    settler: event.params.settler,
    remainingKrill: event.params.remainingKrill,
    settlerKrillBalance: event.params.settlerKrillBalance,
    treasury: event.params.treasury,
  };

  context.GameCore_DelinquentSettled.set(entity);
});

GameCore.GameInitialized.handler(async ({ event, context }) => {
  const entity: GameCore_GameInitialized = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    election: event.params.election,
    startBlock: event.params.startBlock,
  };

  context.GameCore_GameInitialized.set(entity);
});

GameCore.KrillCredited.handler(async ({ event, context }) => {
  const entity: GameCore_KrillCredited = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    amount: event.params.amount,
    krillBalance: event.params.krillBalance,
  };

  context.GameCore_KrillCredited.set(entity);
});

GameCore.KrillDeducted.handler(async ({ event, context }) => {
  const entity: GameCore_KrillDeducted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    amount: event.params.amount,
    remainingKrill: event.params.remainingKrill,
  };

  context.GameCore_KrillDeducted.set(entity);
});

GameCore.Paused.handler(async ({ event, context }) => {
  const entity: GameCore_Paused = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    account: event.params.account,
  };

  context.GameCore_Paused.set(entity);
});

GameCore.PlayerDeactivated.handler(async ({ event, context }) => {
  const entity: GameCore_PlayerDeactivated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    activePlayers: event.params.activePlayers,
  };

  context.GameCore_PlayerDeactivated.set(entity);
});

GameCore.PlayerDeposited.handler(async ({ event, context }) => {
  const entity: GameCore_PlayerDeposited = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    shellAmount: event.params.shellAmount,
    krillBalance: event.params.krillBalance,
  };

  context.GameCore_PlayerDeposited.set(entity);
});

GameCore.PlayerEntered.handler(async ({ event, context }) => {
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
});

GameCore.PlayerPurged.handler(async ({ event, context }) => {
  const entity: GameCore_PlayerPurged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    purger: event.params.purger,
    purgerKrillBalance: event.params.purgerKrillBalance,
    treasury: event.params.treasury,
  };

  context.GameCore_PlayerPurged.set(entity);
});

GameCore.PlayerWithdrew.handler(async ({ event, context }) => {
  const entity: GameCore_PlayerWithdrew = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    remainingKrill: event.params.remainingKrill,
    shellReceived: event.params.shellReceived,
    treasury: event.params.treasury,
  };

  context.GameCore_PlayerWithdrew.set(entity);
});

GameCore.RewardClaimed.handler(async ({ event, context }) => {
  const entity: GameCore_RewardClaimed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    claimedAmount: event.params.claimedAmount,
    krillBalance: event.params.krillBalance,
    treasury: event.params.treasury,
  };

  context.GameCore_RewardClaimed.set(entity);
});

GameCore.RewardDistributed.handler(async ({ event, context }) => {
  const entity: GameCore_RewardDistributed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    amount: event.params.amount,
    perPlayer: event.params.perPlayer,
    currentTerm: event.params.currentTerm,
    currentKing: event.params.currentKing,
    treasury: event.params.treasury,
  };

  context.GameCore_RewardDistributed.set(entity);
});

GameCore.TaxRateChanged.handler(async ({ event, context }) => {
  const entity: GameCore_TaxRateChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    oldRate: event.params.oldRate,
    newRate: event.params.newRate,
    currentTerm: event.params.currentTerm,
    currentKing: event.params.currentKing,
    treasury: event.params.treasury,
  };

  context.GameCore_TaxRateChanged.set(entity);
});

GameCore.TaxSettled.handler(async ({ event, context }) => {
  const entity: GameCore_TaxSettled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    player: event.params.player,
    taxPaid: event.params.taxPaid,
    remainingKrill: event.params.remainingKrill,
    treasury: event.params.treasury,
  };

  context.GameCore_TaxSettled.set(entity);
});

GameCore.TreasuryCredited.handler(async ({ event, context }) => {
  const entity: GameCore_TreasuryCredited = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    amount: event.params.amount,
    treasury: event.params.treasury,
  };

  context.GameCore_TreasuryCredited.set(entity);
});

GameCore.TreasuryDistribution.handler(async ({ event, context }) => {
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
});

GameCore.Unpaused.handler(async ({ event, context }) => {
  const entity: GameCore_Unpaused = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    account: event.params.account,
  };

  context.GameCore_Unpaused.set(entity);
});

GameCore.VoterRewardDistributed.handler(async ({ event, context }) => {
  const entity: GameCore_VoterRewardDistributed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    amount: event.params.amount,
    perVoter: event.params.perVoter,
    currentTerm: event.params.currentTerm,
    currentKing: event.params.currentKing,
    treasury: event.params.treasury,
  };

  context.GameCore_VoterRewardDistributed.set(entity);
});
