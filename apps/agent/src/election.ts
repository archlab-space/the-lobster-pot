import type { Address } from "viem";
import { getPublicClient, getWalletClient, getAgentAddress } from "./client.js";
import { electionAbi } from "./abis/index.js";
import { contracts } from "./config.js";
import type { TxResult, CandidateData, ElectionSnapshot } from "./types.js";

const addr = contracts.election;

async function writeTx(
  functionName: string,
  args: readonly unknown[] = []
): Promise<TxResult> {
  const wallet = getWalletClient();
  const pub = getPublicClient();
  const hash = await wallet.writeContract({
    address: addr,
    abi: electionAbi,
    functionName,
    args,
  } as any);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { hash, blockNumber: receipt.blockNumber };
}

async function readContract<T>(
  functionName: string,
  args: readonly unknown[] = []
): Promise<T> {
  const pub = getPublicClient();
  return pub.readContract({
    address: addr,
    abi: electionAbi,
    functionName,
    args,
  } as any) as Promise<T>;
}

// ─── Write Functions ─────────────────────────────────────────────────

export async function startCampaign(bribePerVote: bigint): Promise<TxResult> {
  return writeTx("startCampaign", [bribePerVote]);
}

export async function fundCampaign(amount: bigint): Promise<TxResult> {
  return writeTx("fundCampaign", [amount]);
}

export async function updateBribePerVote(
  newBribePerVote: bigint
): Promise<TxResult> {
  return writeTx("updateBribePerVote", [newBribePerVote]);
}

export async function vote(candidate: Address): Promise<TxResult> {
  return writeTx("vote", [candidate]);
}

export async function reclaimCampaignFunds(term: bigint): Promise<TxResult> {
  return writeTx("reclaimCampaignFunds", [term]);
}

// ─── View Functions ──────────────────────────────────────────────────

export async function getCurrentTerm(): Promise<bigint> {
  return readContract<bigint>("currentTerm");
}

export async function getCurrentKing(): Promise<Address> {
  return readContract<Address>("getCurrentKing");
}

export async function getCurrentKingVoterCount(): Promise<bigint> {
  return readContract<bigint>("getCurrentKingVoterCount");
}

export async function getBlocksRemainingInTerm(): Promise<bigint> {
  return readContract<bigint>("blocksRemainingInTerm");
}

export async function getCandidateCount(term: bigint): Promise<bigint> {
  return readContract<bigint>("getCandidateCount", [term]);
}

export async function getCandidateList(term: bigint): Promise<Address[]> {
  return readContract<Address[]>("getCandidateList", [term]);
}

export async function getCandidate(
  term: bigint,
  candidate: Address
): Promise<CandidateData> {
  const result = await readContract<
    readonly [bigint, bigint, bigint, boolean]
  >("candidates", [term, candidate]);
  return {
    address: candidate,
    bribePerVote: result[0],
    campaignFunds: result[1],
    voteCount: result[2],
    registered: result[3],
  };
}

export async function checkHasVoted(
  term: bigint,
  voter: Address
): Promise<boolean> {
  return readContract<boolean>("hasVoted", [term, voter]);
}

export async function getVotedFor(
  term: bigint,
  voter: Address
): Promise<Address> {
  return readContract<Address>("votedFor", [term, voter]);
}

export async function getLeadingCandidate(term: bigint): Promise<Address> {
  return readContract<Address>("leadingCandidate", [term]);
}

export async function getLeadingVoteCount(term: bigint): Promise<bigint> {
  return readContract<bigint>("leadingVoteCount", [term]);
}

// ─── Composite (Multicall) ──────────────────────────────────────────

export async function getElectionSnapshot(): Promise<ElectionSnapshot> {
  const pub = getPublicClient();
  const agent = getAgentAddress();

  // First batch: basic election state
  const batch1 = await pub.multicall({
    contracts: [
      { address: addr, abi: electionAbi, functionName: "currentTerm" },
      { address: addr, abi: electionAbi, functionName: "getCurrentKing" },
      { address: addr, abi: electionAbi, functionName: "getCurrentKingVoterCount" },
      { address: addr, abi: electionAbi, functionName: "blocksRemainingInTerm" },
    ],
  });

  const currentTerm = batch1[0].result as bigint;
  const currentKing = batch1[1].result as Address;
  const currentKingVoterCount = batch1[2].result as bigint;
  const blocksRemainingInTerm = batch1[3].result as bigint;

  // Second batch: term-specific data
  const batch2 = await pub.multicall({
    contracts: [
      { address: addr, abi: electionAbi, functionName: "getCandidateList", args: [currentTerm] },
      { address: addr, abi: electionAbi, functionName: "hasVoted", args: [currentTerm, agent] },
      { address: addr, abi: electionAbi, functionName: "votedFor", args: [currentTerm, agent] },
      { address: addr, abi: electionAbi, functionName: "leadingCandidate", args: [currentTerm] },
      { address: addr, abi: electionAbi, functionName: "leadingVoteCount", args: [currentTerm] },
    ],
  });

  const candidateAddrs = batch2[0].result as Address[];
  const hasVoted = batch2[1].result as boolean;
  const votedFor = batch2[2].result as Address;
  const leadingCandidate = batch2[3].result as Address;
  const leadingVoteCount = batch2[4].result as bigint;

  // Third batch: fetch each candidate's data
  let candidates: CandidateData[] = [];
  if (candidateAddrs.length > 0) {
    const candidateCalls = candidateAddrs.map((c) => ({
      address: addr as Address,
      abi: electionAbi,
      functionName: "candidates" as const,
      args: [currentTerm, c] as const,
    }));
    const batch3 = await pub.multicall({ contracts: candidateCalls });
    candidates = candidateAddrs.map((c, i) => {
      const r = batch3[i].result as readonly [bigint, bigint, bigint, boolean];
      return {
        address: c,
        bribePerVote: r[0],
        campaignFunds: r[1],
        voteCount: r[2],
        registered: r[3],
      };
    });
  }

  return {
    currentTerm,
    currentKing,
    currentKingVoterCount,
    blocksRemainingInTerm,
    candidates,
    hasVoted,
    votedFor,
    leadingCandidate,
    leadingVoteCount,
  };
}
