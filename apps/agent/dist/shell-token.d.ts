import type { Address } from "viem";
import type { TxResult } from "./types.js";
export declare function getShellBalance(account?: Address): Promise<bigint>;
export declare function getShellAllowance(spender: Address, owner?: Address): Promise<bigint>;
export declare function approveShell(spender: Address, amount: bigint): Promise<TxResult>;
export declare function transferShell(to: Address, amount: bigint): Promise<TxResult>;
//# sourceMappingURL=shell-token.d.ts.map