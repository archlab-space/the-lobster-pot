import { BaseError, ContractFunctionRevertedError, decodeErrorResult } from "viem";
import { gameCoreAbi, electionAbi } from "./abis/index.js";

const ERROR_MESSAGES: Record<string, string> = {
  // GameCore errors
  ElectionAlreadySet: "Election contract already configured",
  NotInitialized: "Game not initialized",
  NotKing: "Only the current king can do this",
  IsKing: "The king cannot do this",
  NotElection: "Only the election contract can do this",
  PlayerNotActive: "Player is not active in the game",
  PlayerAlreadyActive: "Player is already active",
  InsufficientKrill: "Not enough KRILL balance",
  InsufficientShell: "Not enough SHELL balance",
  InsufficientTreasury: "Not enough KRILL in treasury",
  InvalidTaxRate: "Tax rate must be between 1 and 5 KRILL/block",
  PlayerNotInsolvent: "Player balance is above insolvency threshold",
  ZeroAmount: "Amount cannot be zero",
  BelowEntryTicket: "Must deposit at least 300 SHELL (30,000 KRILL entry ticket)",
  CallerNotEligible: "Caller must be an active player",
  PlayerNotDelinquent: "Player has not exceeded the delinquency grace period",
  CannotSettleSelf: "Cannot settle your own delinquency",
  // Election errors
  TermNotEnded: "Term has not ended yet",
  AlreadyRegistered: "Already registered as candidate this term",
  AlreadyVoted: "Already voted this term",
  NotActivePlayer: "Must be an active player",
  InsufficientBalance: "KRILL balance too low to vote",
  CandidateNotRegistered: "Candidate is not registered this term",
  TooYoungToVote: "Account too new to vote (must wait 100 blocks)",
  NoFundsToReclaim: "No campaign funds to reclaim",
  BribeCannotDecrease: "Bribe per vote can only increase",
  InsufficientCampaignFunds: "Not enough campaign funds to pay bribe",
};

export function decodeContractError(error: unknown): string {
  if (error instanceof BaseError) {
    const revertError = error.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const name = revertError.data?.errorName;
      if (name && name in ERROR_MESSAGES) {
        return ERROR_MESSAGES[name];
      }
      if (name) return name;
    }
    return error.shortMessage || error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
