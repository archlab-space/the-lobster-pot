import { createPublicClient, createWalletClient, http, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "./config.js";
let _publicClient = null;
let _walletClient = null;
export function getPublicClient() {
    if (!_publicClient) {
        _publicClient = createPublicClient({
            chain: monadTestnet,
            transport: http(),
        });
    }
    return _publicClient;
}
export function getWalletClient() {
    if (!_walletClient) {
        const key = process.env.AGENT_PRIVATE_KEY;
        if (!key) {
            throw new Error("AGENT_PRIVATE_KEY environment variable is required");
        }
        const account = privateKeyToAccount(key);
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
//# sourceMappingURL=client.js.map