import { getPublicClient, getWalletClient, getAgentAddress } from "./client.js";
import { electionAbi } from "./abis/index.js";
import { contracts } from "./config.js";
const addr = contracts.election;
async function writeTx(functionName, args = []) {
    const wallet = getWalletClient();
    const pub = getPublicClient();
    const hash = await wallet.writeContract({
        address: addr,
        abi: electionAbi,
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
        abi: electionAbi,
        functionName,
        args,
    });
}
// ─── Write Functions ─────────────────────────────────────────────────
export async function startCampaign(bribePerVote) {
    return writeTx("startCampaign", [bribePerVote]);
}
export async function fundCampaign(amount) {
    return writeTx("fundCampaign", [amount]);
}
export async function updateBribePerVote(newBribePerVote) {
    return writeTx("updateBribePerVote", [newBribePerVote]);
}
export async function vote(candidate) {
    return writeTx("vote", [candidate]);
}
export async function reclaimCampaignFunds(term) {
    return writeTx("reclaimCampaignFunds", [term]);
}
// ─── View Functions ──────────────────────────────────────────────────
export async function getCurrentTerm() {
    return readContract("currentTerm");
}
export async function getCurrentKing() {
    return readContract("getCurrentKing");
}
export async function getCurrentKingVoterCount() {
    return readContract("getCurrentKingVoterCount");
}
export async function getBlocksRemainingInTerm() {
    return readContract("blocksRemainingInTerm");
}
export async function getCandidateCount(term) {
    return readContract("getCandidateCount", [term]);
}
export async function getCandidateList(term) {
    return readContract("getCandidateList", [term]);
}
export async function getCandidate(term, candidate) {
    const result = await readContract("candidates", [term, candidate]);
    return {
        address: candidate,
        bribePerVote: result[0],
        campaignFunds: result[1],
        voteCount: result[2],
        registered: result[3],
    };
}
export async function checkHasVoted(term, voter) {
    return readContract("hasVoted", [term, voter]);
}
export async function getVotedFor(term, voter) {
    return readContract("votedFor", [term, voter]);
}
export async function getLeadingCandidate(term) {
    return readContract("leadingCandidate", [term]);
}
export async function getLeadingVoteCount(term) {
    return readContract("leadingVoteCount", [term]);
}
// ─── Composite (Multicall) ──────────────────────────────────────────
export async function getElectionSnapshot() {
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
    const currentTerm = batch1[0].result;
    const currentKing = batch1[1].result;
    const currentKingVoterCount = batch1[2].result;
    const blocksRemainingInTerm = batch1[3].result;
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
    const candidateAddrs = batch2[0].result;
    const hasVoted = batch2[1].result;
    const votedFor = batch2[2].result;
    const leadingCandidate = batch2[3].result;
    const leadingVoteCount = batch2[4].result;
    // Third batch: fetch each candidate's data
    let candidates = [];
    if (candidateAddrs.length > 0) {
        const candidateCalls = candidateAddrs.map((c) => ({
            address: addr,
            abi: electionAbi,
            functionName: "candidates",
            args: [currentTerm, c],
        }));
        const batch3 = await pub.multicall({ contracts: candidateCalls });
        candidates = candidateAddrs.map((c, i) => {
            const r = batch3[i].result;
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
//# sourceMappingURL=election.js.map