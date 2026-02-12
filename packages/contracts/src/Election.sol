// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IGameCore} from "./interfaces/IGameCore.sol";

contract Election is ReentrancyGuard {
    // ─── Constants ──────────────────────────────────────────────────────
    uint256 public constant TERM_DURATION = 72_000; // ~ 8 hours
    uint256 public constant REGISTRATION_FEE = 1_000_000 * 1e18;
    uint256 public constant VOTER_MIN_BALANCE = 1_000 * 1e18;
    uint64 public constant MIN_VOTER_AGE = 100; // blocks

    // ─── Structs ────────────────────────────────────────────────────────
    struct Candidate {
        uint256 bribePerVote;
        uint256 campaignFunds;
        uint256 voteCount;
        bool registered;
    }

    // ─── State ──────────────────────────────────────────────────────────
    IGameCore public immutable game;
    uint256 public currentTerm;
    uint256 public termStartBlock;

    // term => candidate address => Candidate
    mapping(uint256 => mapping(address => Candidate)) public candidates;
    // term => list of candidate addresses
    mapping(uint256 => address[]) public candidateLists;
    // term => voter => has voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    // term => voter => who they voted for
    mapping(uint256 => mapping(address => address)) public votedFor;

    // Track king's voters for current term
    address public currentKingAddr;
    uint256 public currentKingTerm;
    uint256 public currentKingVoterCount;

    // ─── Events ─────────────────────────────────────────────────────────
    event CampaignStarted(uint256 indexed term, address indexed candidate, uint256 bribePerVote);
    event CampaignFunded(uint256 indexed term, address indexed candidate, uint256 amount);
    event VoteCast(uint256 indexed term, address indexed voter, address indexed candidate, uint256 bribe);
    event ElectionFinalized(uint256 indexed term, address indexed winner, uint256 voteCount);
    event TermAdvanced(uint256 indexed newTerm, address indexed newKing);

    // ─── Errors ─────────────────────────────────────────────────────────
    error TermNotEnded();
    error ElectionNotFinalized();
    error AlreadyRegistered();
    error AlreadyVoted();
    error NotActivePlayer();
    error InsufficientBalance();
    error CandidateNotRegistered();
    error TooYoungToVote();
    error ElectionAlreadyFinalized();
    error NoCandidates();
    error TermAlreadyAdvanced();

    // ─── State for finalization ─────────────────────────────────────────
    // term => winner address (set during finalize)
    mapping(uint256 => address) public termWinner;
    // term => whether finalized
    mapping(uint256 => bool) public termFinalized;

    // ─── Constructor ────────────────────────────────────────────────────
    constructor(address _game) {
        game = IGameCore(_game);
        termStartBlock = block.number;
    }

    // ─── Campaign Functions ─────────────────────────────────────────────

    function startCampaign(uint256 bribePerVote) external nonReentrant {
        uint256 term = _nextTerm();
        if (candidates[term][msg.sender].registered) revert AlreadyRegistered();
        if (!game.isActivePlayer(msg.sender)) revert NotActivePlayer();

        // Burn registration fee via deductKrill (KRILL is destroyed)
        game.deductKrill(msg.sender, REGISTRATION_FEE);

        candidates[term][msg.sender] = Candidate({
            bribePerVote: bribePerVote,
            campaignFunds: 0,
            voteCount: 0,
            registered: true
        });
        candidateLists[term].push(msg.sender);

        emit CampaignStarted(term, msg.sender, bribePerVote);
    }

    function fundCampaign(uint256 amount) external nonReentrant {
        uint256 term = _nextTerm();
        Candidate storage c = candidates[term][msg.sender];
        if (!c.registered) revert CandidateNotRegistered();
        if (!game.isActivePlayer(msg.sender)) revert NotActivePlayer();

        game.deductKrill(msg.sender, amount);
        c.campaignFunds += amount;

        emit CampaignFunded(term, msg.sender, amount);
    }

    // ─── Vote ───────────────────────────────────────────────────────────

    function vote(address candidate) external nonReentrant {
        uint256 term = _nextTerm();
        if (hasVoted[term][msg.sender]) revert AlreadyVoted();
        if (!game.isActivePlayer(msg.sender)) revert NotActivePlayer();

        // Flash-loan protection
        uint64 joinedBlock = game.getJoinedBlock(msg.sender);
        if (uint64(block.number) < joinedBlock + MIN_VOTER_AGE) revert TooYoungToVote();

        // Balance check (effective balance must be above minimum)
        uint256 balance = game.getEffectiveBalance(msg.sender);
        if (balance < VOTER_MIN_BALANCE) revert InsufficientBalance();

        Candidate storage c = candidates[term][candidate];
        if (!c.registered) revert CandidateNotRegistered();

        hasVoted[term][msg.sender] = true;
        votedFor[term][msg.sender] = candidate;
        c.voteCount++;

        // Pay bribe from campaign funds
        uint256 bribe;
        if (c.campaignFunds >= c.bribePerVote && c.bribePerVote > 0) {
            bribe = c.bribePerVote;
            c.campaignFunds -= bribe;
            game.creditKrill(msg.sender, bribe);
        }

        emit VoteCast(term, msg.sender, candidate, bribe);
    }

    // ─── Finalize & Advance ─────────────────────────────────────────────

    function finalizeElection() external nonReentrant {
        uint256 term = _nextTerm();
        if (block.number < termStartBlock + TERM_DURATION) revert TermNotEnded();
        if (termFinalized[term]) revert ElectionAlreadyFinalized();

        address[] storage cands = candidateLists[term];
        if (cands.length == 0) {
            // No candidates — incumbent stays
            termWinner[term] = game.king();
            termFinalized[term] = true;
            emit ElectionFinalized(term, game.king(), 0);
            return;
        }

        // Find winner (highest votes, first registered wins ties)
        address winner = cands[0];
        uint256 highestVotes = candidates[term][cands[0]].voteCount;

        for (uint256 i = 1; i < cands.length; i++) {
            uint256 votes = candidates[term][cands[i]].voteCount;
            if (votes > highestVotes) {
                highestVotes = votes;
                winner = cands[i];
            }
        }

        termWinner[term] = winner;
        termFinalized[term] = true;

        emit ElectionFinalized(term, winner, highestVotes);
    }

    function advanceTerm() external nonReentrant {
        uint256 term = _nextTerm();
        if (!termFinalized[term]) revert ElectionNotFinalized();

        address winner = termWinner[term];

        // Refund unspent campaign funds
        address[] storage cands = candidateLists[term];
        for (uint256 i = 0; i < cands.length; i++) {
            address cand = cands[i];
            uint256 remaining = candidates[term][cand].campaignFunds;
            if (remaining > 0) {
                candidates[term][cand].campaignFunds = 0;
                if (game.isActivePlayer(cand)) {
                    game.creditKrill(cand, remaining);
                } else {
                    // Purged candidate — funds go to treasury
                    game.creditTreasury(remaining);
                }
            }
        }

        // Set new king
        game.setKing(winner);

        // Track voter count for the winning candidate
        currentKingAddr = winner;
        currentKingTerm = term;
        currentKingVoterCount = candidates[term][winner].voteCount;

        // Advance term
        currentTerm++;
        termStartBlock = block.number;

        emit TermAdvanced(currentTerm, winner);
    }

    // ─── View Functions ─────────────────────────────────────────────────

    function getCurrentKingVoterCount() external view returns (uint256) {
        return currentKingVoterCount;
    }

    function didVoteForCurrentKing(address voter) external view returns (bool) {
        if (currentKingAddr == address(0)) return false;
        return votedFor[currentKingTerm][voter] == currentKingAddr && hasVoted[currentKingTerm][voter];
    }

    function blocksRemainingInTerm() external view returns (uint256) {
        uint256 elapsed = block.number - termStartBlock;
        if (elapsed >= TERM_DURATION) return 0;
        return TERM_DURATION - elapsed;
    }

    function getCandidateCount(uint256 term) external view returns (uint256) {
        return candidateLists[term].length;
    }

    function getCandidateList(uint256 term) external view returns (address[] memory) {
        return candidateLists[term];
    }

    // ─── Internal ───────────────────────────────────────────────────────

    function _nextTerm() internal view returns (uint256) {
        return currentTerm;
    }
}
