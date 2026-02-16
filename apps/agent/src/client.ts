import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "./config.js";

let _publicClient: PublicClient | null = null;
let _walletClient: WalletClient<Transport, Chain, Account> | null = null;

export function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http(),
    });
  }
  return _publicClient;
}

export function getWalletClient(): WalletClient<Transport, Chain, Account> {
  if (!_walletClient) {
    const key = process.env.AGENT_PRIVATE_KEY;
    if (!key) {
      throw new Error("AGENT_PRIVATE_KEY environment variable is required");
    }
    const account = privateKeyToAccount(key as `0x${string}`);
    _walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(),
    });
  }
  return _walletClient;
}

export function getAgentAddress() {
  return getWalletClient().account.address;
}
