import { getPublicClient, getWalletClient, getAgentAddress } from "./client.js";
import { shellTokenAbi } from "./abis/index.js";
import { contracts } from "./config.js";
const addr = contracts.shellToken;
export async function getShellBalance(account) {
    const pub = getPublicClient();
    return pub.readContract({
        address: addr,
        abi: shellTokenAbi,
        functionName: "balanceOf",
        args: [account ?? getAgentAddress()],
    });
}
export async function getShellAllowance(spender, owner) {
    const pub = getPublicClient();
    return pub.readContract({
        address: addr,
        abi: shellTokenAbi,
        functionName: "allowance",
        args: [owner ?? getAgentAddress(), spender],
    });
}
export async function approveShell(spender, amount) {
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
export async function transferShell(to, amount) {
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
//# sourceMappingURL=shell-token.js.map