import { type PublicClient, type WalletClient, type Chain, type Transport, type Account } from "viem";
export declare function getPublicClient(): PublicClient;
export declare function getWalletClient(): WalletClient<Transport, Chain, Account>;
export declare function getAgentAddress(): `0x${string}`;
//# sourceMappingURL=client.d.ts.map