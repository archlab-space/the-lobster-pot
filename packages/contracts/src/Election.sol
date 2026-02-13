// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IGameCore} from "./interfaces/IGameCore.sol";

contract Election is Initializable, ReentrancyGuard, OwnableUpgradeable, UUPSUpgradeable {
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
    IGameCore public game;
    uint256 public gameStartBlock;

    // term => candidate address => Candidate
    mapping(uint256 => mapping(address => Candidate)) public candidates;
    // term => list of candidate addresses
    mapping(uint256 => address[]) public candidateLists;
    // term => voter => has voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    // term => voter => who they voted for
    mapping(uint256 => mapping(address => address)) public votedFor;

    // Real-time leader tracking (first to reach vote count wins)
    mapping(uint256 => address) public leadingCandidate;
    mapping(uint256 => uint256) public leadingVoteCount;

    // ─── Storage Gap ────────────────────────────────────────────────────
    uint256[50] private __gap;

    // ─── Events ─────────────────────────────────────────────────────────
    event CampaignStarted(uint256 indexed term, address indexed candidate, uint256 bribePerVote);
    event CampaignFunded(uint256 indexed term, address indexed candidate, uint256 amount);
    event VoteCast(uint256 indexed term, address indexed voter, address indexed candidate, uint256 bribe);
    event CampaignFundsReclaimed(uint256 indexed term, address indexed candidate, uint256 amount);
    event BribePerVoteUpdated(uint256 indexed term, address indexed candidate, uint256 oldBribe, uint256 newBribe);

    // ─── Errors ─────────────────────────────────────────────────────────
    error TermNotEnded();
    error AlreadyRegistered();
    error AlreadyVoted();
    error NotActivePlayer();
    error InsufficientBalance();
    error CandidateNotRegistered();
    error TooYoungToVote();
    error NoFundsToReclaim();
    error BribeCannotDecrease();

    // ─── Modifiers ──────────────────────────────────────────────────────
    modifier whenGameNotPaused() {
        require(!game.paused(), "GameCore is paused");
        _;
    }

    // ─── Constructor (disabled for proxy) ────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─── Initialization ─────────────────────────────────────────────────
    function initialize(address _game, address _owner) external initializer {
        __Ownable_init(_owner);
        game = IGameCore(_game);
        gameStartBlock = block.number;
    }

    // ─── UUPS ───────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ─── View Functions ─────────────────────────────────────────────────

    function currentTerm() public view returns (uint256) {
        return (block.number - gameStartBlock) / TERM_DURATION;
    }

    // ─── Campaign Functions ─────────────────────────────────────────────

    function startCampaign(uint256 bribePerVote) external nonReentrant whenGameNotPaused {
        uint256 term = currentTerm(); // Register for current term
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

    function fundCampaign(uint256 amount) external nonReentrant whenGameNotPaused {
        uint256 term = currentTerm(); // Fund for current term
        Candidate storage c = candidates[term][msg.sender];
        if (!c.registered) revert CandidateNotRegistered();
        if (!game.isActivePlayer(msg.sender)) revert NotActivePlayer();

        game.deductKrill(msg.sender, amount);
        c.campaignFunds += amount;

        emit CampaignFunded(term, msg.sender, amount);
    }

    function updateBribePerVote(uint256 newBribePerVote) external nonReentrant whenGameNotPaused {
        uint256 term = currentTerm(); // Update for current term
        Candidate storage c = candidates[term][msg.sender];
        if (!c.registered) revert CandidateNotRegistered();
        if (!game.isActivePlayer(msg.sender)) revert NotActivePlayer();
        if (newBribePerVote < c.bribePerVote) revert BribeCannotDecrease();

        uint256 oldBribePerVote = c.bribePerVote;
        c.bribePerVote = newBribePerVote;

        emit BribePerVoteUpdated(term, msg.sender, oldBribePerVote, newBribePerVote);
    }

    // ─── Vote ───────────────────────────────────────────────────────────

    function vote(address candidate) external nonReentrant whenGameNotPaused {
        uint256 term = currentTerm(); // Vote for current term
        if (hasVoted[term][msg.sender]) revert AlreadyVoted();
        if (!game.isActivePlayer(msg.sender)) revert NotActivePlayer();

        // Flash-loan protection
        uint64 joinedBlock = game.getJoinedBlock(msg.sender);
        if (uint64(block.number) < joinedBlock + MIN_VOTER_AGE) revert TooYoungToVote();

        // Balance check (effective balance must be above minimum)
        uint256 balance = game.krillBalanceOf(msg.sender);
        if (balance < VOTER_MIN_BALANCE) revert InsufficientBalance();

        Candidate storage c = candidates[term][candidate];
        if (!c.registered) revert CandidateNotRegistered();

        hasVoted[term][msg.sender] = true;
        votedFor[term][msg.sender] = candidate;
        c.voteCount++;

        // Track leading candidate (first to reach vote count wins, use > not >=)
        if (c.voteCount > leadingVoteCount[term]) {
            leadingCandidate[term] = candidate;
            leadingVoteCount[term] = c.voteCount;
        }

        // Pay bribe from campaign funds
        uint256 bribe;
        if (c.campaignFunds >= c.bribePerVote && c.bribePerVote > 0) {
            bribe = c.bribePerVote;
            c.campaignFunds -= bribe;
            game.creditKrill(msg.sender, bribe);
        }

        emit VoteCast(term, msg.sender, candidate, bribe);
    }

    // ─── Campaign Fund Reclaim ──────────────────────────────────────────

    function reclaimCampaignFunds(uint256 term) external nonReentrant whenGameNotPaused {
        if (currentTerm() <= term) revert TermNotEnded();

        Candidate storage c = candidates[term][msg.sender];
        uint256 remaining = c.campaignFunds;
        if (remaining == 0) revert NoFundsToReclaim();

        c.campaignFunds = 0;

        if (game.isActivePlayer(msg.sender)) {
            game.creditKrill(msg.sender, remaining);
        } else {
            // Purged players forfeit funds to treasury
            game.creditTreasury(remaining);
        }

        emit CampaignFundsReclaimed(term, msg.sender, remaining);
    }

    // ─── View Functions (continued) ─────────────────────────────────────

    function getCurrentKing() external view returns (address) {
        uint256 term = currentTerm();
        if (term == 0) return address(0); // No king in term 0
        return leadingCandidate[term - 1]; // Previous term's leader
    }

    function getCurrentKingVoterCount() external view returns (uint256) {
        uint256 term = currentTerm();
        if (term == 0) return 0;
        address king = leadingCandidate[term - 1];
        if (king == address(0)) return 0;
        return candidates[term - 1][king].voteCount;
    }

    function didVoteForCurrentKing(address voter) external view returns (bool) {
        uint256 term = currentTerm();
        if (term == 0) return false; // No king in term 0
        address king = leadingCandidate[term - 1];
        if (king == address(0)) return false;
        return votedFor[term - 1][voter] == king && hasVoted[term - 1][voter];
    }

    function blocksRemainingInTerm() external view returns (uint256) {
        uint256 termStart = gameStartBlock + (currentTerm() * TERM_DURATION);
        uint256 termEnd = termStart + TERM_DURATION;
        if (block.number >= termEnd) return 0;
        return termEnd - block.number;
    }

    function getCandidateCount(uint256 term) external view returns (uint256) {
        return candidateLists[term].length;
    }

    function getCandidateList(uint256 term) external view returns (address[] memory) {
        return candidateLists[term];
    }
}
