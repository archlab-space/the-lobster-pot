import type { Address } from "viem";
import { getPublicClient, getWalletClient, getAgentAddress } from "./client.js";
import { gameCoreAbi, shellTokenAbi, electionAbi } from "./abis/index.js";
import { contracts } from "./config.js";
import type { TxResult, PlayerData, GameSnapshot } from "./types.js";

const addr = contracts.gameCore;
const maxUint256 = 2n ** 256n - 1n;

// ─── Internal Helpers ────────────────────────────────────────────────

async function ensureShellApproval(needed: bigint): Promise<void> {
  const pub = getPublicClient();
  const wallet = getWalletClient();
  const agentAddress = getAgentAddress();

  const allowance = await pub.readContract({
    address: contracts.shellToken,
    abi: shellTokenAbi,
    functionName: "allowance",
    args: [agentAddress, addr],
  });

  if (allowance < needed) {
    try {
      const hash = await wallet.writeContract({
        address: contracts.shellToken,
        abi: shellTokenAbi,
        functionName: "approve",
        args: [addr, maxUint256],
      });
      await pub.waitForTransactionReceipt({ hash });
    } catch (err) {
      throw err;
    }
  }
}

async function writeTx(
  functionName: string,
  args: readonly unknown[] = []
): Promise<TxResult> {
  const wallet = getWalletClient();
  const pub = getPublicClient();
  const hash = await wallet.writeContract({
    address: addr,
    abi: gameCoreAbi,
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
    abi: gameCoreAbi,
    functionName,
    args,
  } as any) as Promise<T>;
}

// ─── Write Functions ─────────────────────────────────────────────────

export async function enter(shellAmount: bigint): Promise<TxResult> {
  await ensureShellApproval(shellAmount);
  return writeTx("enter", [shellAmount]);
}

export async function deposit(shellAmount: bigint): Promise<TxResult> {
  await ensureShellApproval(shellAmount);
  return writeTx("deposit", [shellAmount]);
}

export async function withdraw(krillAmount: bigint): Promise<TxResult> {
  return writeTx("withdraw", [krillAmount]);
}

export async function settleTax(): Promise<TxResult> {
  return writeTx("settleTax");
}

export async function claimReward(): Promise<TxResult> {
  return writeTx("claimReward");
}

export async function purge(playerAddr: Address): Promise<TxResult> {
  return writeTx("purge", [playerAddr]);
}

export async function settleDelinquent(
  playerAddr: Address
): Promise<TxResult> {
  return writeTx("settleDelinquent", [playerAddr]);
}

export async function setTaxRate(newRate: bigint): Promise<TxResult> {
  return writeTx("setTaxRate", [newRate]);
}

export async function distributeToAddress(
  to: Address,
  amount: bigint
): Promise<TxResult> {
  return writeTx("distributeToAddress", [to, amount]);
}

export async function distributeToAllPlayers(
  amount: bigint
): Promise<TxResult> {
  return writeTx("distributeToAllPlayers", [amount]);
}

export async function distributeToVoters(amount: bigint): Promise<TxResult> {
  return writeTx("distributeToVoters", [amount]);
}

// ─── View Functions ──────────────────────────────────────────────────

export async function getKing(): Promise<Address> {
  return readContract<Address>("king");
}

export async function getTreasury(): Promise<bigint> {
  return readContract<bigint>("treasury");
}

export async function getEffectiveTreasury(): Promise<bigint> {
  return readContract<bigint>("getEffectiveTreasury");
}

export async function getActivePlayers(): Promise<bigint> {
  return readContract<bigint>("activePlayers");
}

export async function getTaxRate(): Promise<bigint> {
  return readContract<bigint>("taxRate");
}

export async function getEffectiveBalance(addr: Address): Promise<bigint> {
  return readContract<bigint>("getEffectiveBalance", [addr]);
}

export async function getKrillBalance(addr: Address): Promise<bigint> {
  return readContract<bigint>("krillBalanceOf", [addr]);
}

export async function checkIsInsolvent(addr: Address): Promise<boolean> {
  return readContract<boolean>("isInsolvent", [addr]);
}

export async function checkIsDelinquent(addr: Address): Promise<boolean> {
  return readContract<boolean>("isDelinquent", [addr]);
}

export async function checkIsActivePlayer(addr: Address): Promise<boolean> {
  return readContract<boolean>("isActivePlayer", [addr]);
}

export async function getPendingReward(addr: Address): Promise<bigint> {
  return readContract<bigint>("pendingReward", [addr]);
}

export async function getPendingVoterReward(addr: Address): Promise<bigint> {
  return readContract<bigint>("pendingVoterReward", [addr]);
}

export async function getJoinedBlock(addr: Address): Promise<bigint> {
  return readContract<bigint>("getJoinedBlock", [addr]);
}

export async function getEntryCount(addr: Address): Promise<number> {
  return readContract<number>("getEntryCount", [addr]);
}

export async function getPlayerRaw(addr: Address) {
  return readContract<readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean]>(
    "players",
    [addr]
  );
}

// ─── Composite (Multicall) ──────────────────────────────────────────

export async function getPlayerData(playerAddr: Address): Promise<PlayerData> {
  const pub = getPublicClient();
  const results = await pub.multicall({
    contracts: [
      { address: addr, abi: gameCoreAbi, functionName: "players", args: [playerAddr] },
      { address: addr, abi: gameCoreAbi, functionName: "getEffectiveBalance", args: [playerAddr] },
      { address: addr, abi: gameCoreAbi, functionName: "isInsolvent", args: [playerAddr] },
      { address: addr, abi: gameCoreAbi, functionName: "isDelinquent", args: [playerAddr] },
      { address: addr, abi: gameCoreAbi, functionName: "pendingReward", args: [playerAddr] },
      { address: addr, abi: gameCoreAbi, functionName: "pendingVoterReward", args: [playerAddr] },
    ],
  });

  const player = results[0].result as readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean];
  const effectiveBalance = results[1].result as bigint;
  const isInsolvent = results[2].result as boolean;
  const isDelinquent = results[3].result as boolean;
  const pendingReward = results[4].result as bigint;
  const pendingVoterReward = results[5].result as bigint;

  return {
    address: playerAddr,
    krillBalance: player[0],
    effectiveBalance,
    isActive: player[7],
    isInsolvent,
    isDelinquent,
    pendingReward,
    pendingVoterReward,
    lastTaxBlock: player[4],
    joinedBlock: player[5],
    entryCount: Number(player[6]),
  };
}

export async function getMyStatus(): Promise<PlayerData> {
  return getPlayerData(getAgentAddress());
}

export async function getGameSnapshot(): Promise<GameSnapshot> {
  const pub = getPublicClient();
  const results = await pub.multicall({
    contracts: [
      { address: addr, abi: gameCoreAbi, functionName: "king" },
      { address: addr, abi: gameCoreAbi, functionName: "treasury" },
      { address: addr, abi: gameCoreAbi, functionName: "getEffectiveTreasury" },
      { address: addr, abi: gameCoreAbi, functionName: "activePlayers" },
      { address: addr, abi: gameCoreAbi, functionName: "taxRate" },
      { address: contracts.election, abi: electionAbi, functionName: "currentTerm" },
      { address: contracts.election, abi: electionAbi, functionName: "blocksRemainingInTerm" },
    ],
  });

  return {
    king: results[0].result as Address,
    treasury: results[1].result as bigint,
    effectiveTreasury: results[2].result as bigint,
    activePlayers: results[3].result as bigint,
    taxRate: results[4].result as bigint,
    currentTerm: results[5].result as bigint,
    blocksRemainingInTerm: results[6].result as bigint,
  };
}
