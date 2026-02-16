import type { Address } from "viem";
import { getPublicClient, getWalletClient, getAgentAddress } from "./client.js";
import { shellTokenAbi } from "./abis/index.js";
import { contracts } from "./config.js";
import type { TxResult } from "./types.js";

const addr = contracts.shellToken;

export async function getShellBalance(account?: Address): Promise<bigint> {
  const pub = getPublicClient();
  return pub.readContract({
    address: addr,
    abi: shellTokenAbi,
    functionName: "balanceOf",
    args: [account ?? getAgentAddress()],
  });
}

export async function getShellAllowance(
  spender: Address,
  owner?: Address
): Promise<bigint> {
  const pub = getPublicClient();
  return pub.readContract({
    address: addr,
    abi: shellTokenAbi,
    functionName: "allowance",
    args: [owner ?? getAgentAddress(), spender],
  });
}

export async function approveShell(
  spender: Address,
  amount: bigint
): Promise<TxResult> {
  const wallet = getWalletClient();
  const pub = getPublicClient();
  const hash = await wallet.writeContract({
    address: addr,
    abi: shellTokenAbi,
    functionName: "approve",
    args: [spender, amount],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { hash, blockNumber: receipt.blockNumber };
}

export async function transferShell(
  to: Address,
  amount: bigint
): Promise<TxResult> {
  const wallet = getWalletClient();
  const pub = getPublicClient();
  const hash = await wallet.writeContract({
    address: addr,
    abi: shellTokenAbi,
    functionName: "transfer",
    args: [to, amount],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { hash, blockNumber: receipt.blockNumber };
}
