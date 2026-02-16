import { getPublicClient, getWalletClient, getAgentAddress } from "./client.js";
import { gameCoreAbi, shellTokenAbi, electionAbi } from "./abis/index.js";
import { contracts } from "./config.js";
const addr = contracts.gameCore;
const maxUint256 = 2n ** 256n - 1n;
// ─── Internal Helpers ────────────────────────────────────────────────
async function ensureShellApproval(needed) {
    const pub = getPublicClient();
    const wallet = getWalletClient();
    const allowance = await pub.readContract({
        address: contracts.shellToken,
        abi: shellTokenAbi,
        functionName: "allowance",
        args: [getAgentAddress(), addr],
    });
    if (allowance < needed) {
        const hash = await wallet.writeContract({
            address: contracts.shellToken,
            abi: shellTokenAbi,
            functionName: "approve",
            args: [addr, maxUint256],
        });
        await pub.waitForTransactionReceipt({ hash });
    }
}
async function writeTx(functionName, args = []) {
    const wallet = getWalletClient();
    const pub = getPublicClient();
    const hash = await wallet.writeContract({
        address: addr,
        abi: gameCoreAbi,
        functionName,
        args,
    });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    return { hash, blockNumber: receipt.blockNumber };
}
async function readContract(functionName, args = []) {
    const pub = getPublicClient();
    return pub.readContract({
        address: addr,
        abi: gameCoreAbi,
        functionName,
        args,
    });
}
// ─── Write Functions ─────────────────────────────────────────────────
export async function enter(shellAmount) {
    await ensureShellApproval(shellAmount);
    return writeTx("enter", [shellAmount]);
}
export async function deposit(shellAmount) {
    await ensureShellApproval(shellAmount);
    return writeTx("deposit", [shellAmount]);
}
export async function withdraw(krillAmount) {
    return writeTx("withdraw", [krillAmount]);
}
export async function settleTax() {
    return writeTx("settleTax");
}
export async function claimReward() {
    return writeTx("claimReward");
}
export async function purge(playerAddr) {
    return writeTx("purge", [playerAddr]);
}
export async function settleDelinquent(playerAddr) {
    return writeTx("settleDelinquent", [playerAddr]);
}
export async function setTaxRate(newRate) {
    return writeTx("setTaxRate", [newRate]);
}
export async function distributeToAddress(to, amount) {
    return writeTx("distributeToAddress", [to, amount]);
}
export async function distributeToAllPlayers(amount) {
    return writeTx("distributeToAllPlayers", [amount]);
}
export async function distributeToVoters(amount) {
    return writeTx("distributeToVoters", [amount]);
}
// ─── View Functions ──────────────────────────────────────────────────
export async function getKing() {
    return readContract("king");
}
export async function getTreasury() {
    return readContract("treasury");
}
export async function getEffectiveTreasury() {
    return readContract("getEffectiveTreasury");
}
export async function getActivePlayers() {
    return readContract("activePlayers");
}
export async function getTaxRate() {
    return readContract("taxRate");
}
export async function getEffectiveBalance(addr) {
    return readContract("getEffectiveBalance", [addr]);
}
export async function getKrillBalance(addr) {
    return readContract("krillBalanceOf", [addr]);
}
export async function checkIsInsolvent(addr) {
    return readContract("isInsolvent", [addr]);
}
export async function checkIsDelinquent(addr) {
    return readContract("isDelinquent", [addr]);
}
export async function checkIsActivePlayer(addr) {
    return readContract("isActivePlayer", [addr]);
}
export async function getPendingReward(addr) {
    return readContract("pendingReward", [addr]);
}
export async function getPendingVoterReward(addr) {
    return readContract("pendingVoterReward", [addr]);
}
export async function getJoinedBlock(addr) {
    return readContract("getJoinedBlock", [addr]);
}
export async function getEntryCount(addr) {
    return readContract("getEntryCount", [addr]);
}
export async function getPlayerRaw(addr) {
    return readContract("players", [addr]);
}
// ─── Composite (Multicall) ──────────────────────────────────────────
export async function getPlayerData(playerAddr) {
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
    const player = results[0].result;
    const effectiveBalance = results[1].result;
    const isInsolvent = results[2].result;
    const isDelinquent = results[3].result;
    const pendingReward = results[4].result;
    const pendingVoterReward = results[5].result;
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
export async function getMyStatus() {
    return getPlayerData(getAgentAddress());
}
export async function getGameSnapshot() {
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
        king: results[0].result,
        treasury: results[1].result,
        effectiveTreasury: results[2].result,
        activePlayers: results[3].result,
        taxRate: results[4].result,
        currentTerm: results[5].result,
        blocksRemainingInTerm: results[6].result,
    };
}
//# sourceMappingURL=game-core.js.map