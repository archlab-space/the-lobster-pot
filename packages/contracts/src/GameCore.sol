// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IElection} from "./interfaces/IElection.sol";

contract GameCore is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constitution Constants ─────────────────────────────────────────
    uint256 public constant EXCHANGE_RATE = 100;
    uint256 public constant EXIT_TAX_BPS = 2000;
    uint256 public constant EXIT_BURN_BPS = 1000;
    uint256 public constant EXIT_TREASURY_BPS = 1000;
    uint256 public constant ENTRY_TICKET = 30_000 * 1e18;
    uint256 public constant INSOLVENCY_THRESHOLD = 1_000 * 1e18;
    uint256 public constant YIELD_PER_BLOCK = 250 * 1e18;
    uint256 public constant MIN_TAX_RATE = 1 * 1e18;
    uint256 public constant MAX_TAX_RATE = 5 * 1e18;
    uint256 public constant MAX_KRILL_FROM_YIELD = 750_000_000 * EXCHANGE_RATE * 1e18;
    uint256 internal constant REWARD_PRECISION = 1e18;

    // ─── Player Struct ──────────────────────────────────────────────────
    struct Player {
        uint256 krillBalance;
        uint256 rewardDebt;
        uint256 voterRewardDebt;
        uint64 lastInteractionBlock;
        uint64 joinedBlock;
        bool isActive;
        bool hasEnteredBefore;
    }

    // ─── State ──────────────────────────────────────────────────────────
    IERC20 public immutable shellToken;
    address public king;
    IElection public election;
    bool public initialized;
    uint256 public gameStartBlock;

    mapping(address => Player) public players;
    uint256 public activePlayers;
    uint256 public treasury;

    // Tax state
    uint256 public taxRate;
    uint256 public previousTaxRate;
    uint256 public taxRateChangeBlock;

    // Treasury yield state
    uint256 public lastYieldUpdateBlock;
    uint256 public totalYieldEmitted;

    // Reward distribution (MasterChef pattern — 1 share per active player)
    uint256 public accRewardPerPlayer;

    // Voter reward distribution (epoch-based)
    uint256 public voterRewardEpoch;
    uint256 public accVoterRewardPerVoter;

    // ─── Events ─────────────────────────────────────────────────────────
    event PlayerEntered(address indexed player, uint256 shellAmount, uint256 krillAmount);
    event PlayerDeposited(address indexed player, uint256 shellAmount, uint256 krillAmount);
    event PlayerWithdrew(address indexed player, uint256 krillAmount, uint256 shellReceived);
    event PlayerPurged(address indexed player, address indexed purger, uint256 krillBalance);
    event TaxRateChanged(uint256 oldRate, uint256 newRate);
    event TreasuryDistribution(address indexed to, uint256 amount);
    event RewardDistributed(uint256 amount);
    event VoterRewardDistributed(uint256 amount);
    event RewardClaimed(address indexed player, uint256 amount);
    event VoterRewardClaimed(address indexed player, uint256 amount);
    event KingChanged(address indexed oldKing, address indexed newKing);
    event GameInitialized(address indexed election, uint256 startBlock);

    // ─── Errors ─────────────────────────────────────────────────────────
    error AlreadyInitialized();
    error NotInitialized();
    error NotKing();
    error NotElection();
    error PlayerNotActive();
    error PlayerAlreadyActive();
    error InsufficientKrill();
    error InsufficientShell();
    error InsufficientTreasury();
    error InvalidTaxRate();
    error PlayerNotInsolvent();
    error ZeroAmount();
    error BelowEntryTicket();
    error CallerNotEligible();

    // ─── Modifiers ──────────────────────────────────────────────────────
    modifier onlyKing() {
        if (msg.sender != king) revert NotKing();
        _;
    }

    modifier onlyElection() {
        if (msg.sender != address(election)) revert NotElection();
        _;
    }

    modifier onlyInitialized() {
        if (!initialized) revert NotInitialized();
        _;
    }

    modifier settlePlayer(address addr) {
        _settlePlayer(addr);
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────
    constructor(address _shellToken) {
        shellToken = IERC20(_shellToken);
        taxRate = MIN_TAX_RATE;
        previousTaxRate = MIN_TAX_RATE;
    }

    // ─── Initialization ─────────────────────────────────────────────────
    function initialize(address _election) external {
        if (initialized) revert AlreadyInitialized();
        initialized = true;
        election = IElection(_election);
        gameStartBlock = block.number;
        lastYieldUpdateBlock = block.number;
        taxRateChangeBlock = block.number;
        emit GameInitialized(_election, block.number);
    }

    // ─── Player Functions ───────────────────────────────────────────────

    function enter(uint256 shellAmount) external nonReentrant onlyInitialized {
        Player storage p = players[msg.sender];
        if (p.isActive) revert PlayerAlreadyActive();

        uint256 krillAmount = shellAmount * EXCHANGE_RATE;
        if (krillAmount < ENTRY_TICKET) revert BelowEntryTicket();

        shellToken.safeTransferFrom(msg.sender, address(this), shellAmount);

        _updateTreasuryYield();

        p.krillBalance = krillAmount - ENTRY_TICKET;
        treasury += ENTRY_TICKET;
        p.lastInteractionBlock = uint64(block.number);
        p.joinedBlock = uint64(block.number);
        p.isActive = true;
        p.hasEnteredBefore = true;
        p.rewardDebt = accRewardPerPlayer;
        p.voterRewardDebt = accVoterRewardPerVoter;

        activePlayers++;

        emit PlayerEntered(msg.sender, shellAmount, krillAmount);
    }

    function deposit(uint256 shellAmount) external nonReentrant onlyInitialized settlePlayer(msg.sender) {
        if (shellAmount == 0) revert ZeroAmount();
        Player storage p = players[msg.sender];
        if (!p.isActive) revert PlayerNotActive();

        uint256 krillAmount = shellAmount * EXCHANGE_RATE;
        shellToken.safeTransferFrom(msg.sender, address(this), shellAmount);

        p.krillBalance += krillAmount;

        emit PlayerDeposited(msg.sender, shellAmount, krillAmount);
    }

    function withdraw(uint256 krillAmount) external nonReentrant onlyInitialized settlePlayer(msg.sender) {
        if (krillAmount == 0) revert ZeroAmount();
        Player storage p = players[msg.sender];
        if (!p.isActive) revert PlayerNotActive();
        if (p.krillBalance < krillAmount) revert InsufficientKrill();

        uint256 taxAmount = (krillAmount * EXIT_TAX_BPS) / 10000;
        uint256 burnAmount = (krillAmount * EXIT_BURN_BPS) / 10000;
        uint256 treasuryAmount = (krillAmount * EXIT_TREASURY_BPS) / 10000;
        uint256 netKrill = krillAmount - taxAmount;
        uint256 shellOut = netKrill / EXCHANGE_RATE;

        p.krillBalance -= krillAmount;

        // Treasury gets its share as KRILL
        treasury += treasuryAmount;

        // Burn share: burn the SHELL equivalent
        uint256 shellBurn = burnAmount / EXCHANGE_RATE;
        if (shellBurn > 0) {
            // Transfer to zero address for burn (ShellToken is ERC20Burnable but we hold the tokens)
            shellToken.safeTransfer(address(0xdead), shellBurn);
        }

        // If player balance drops below insolvency, deactivate
        if (p.krillBalance < INSOLVENCY_THRESHOLD && p.krillBalance > 0) {
            // Player can withdraw to zero or stay above threshold
        }

        if (p.krillBalance == 0) {
            _deactivatePlayer(msg.sender);
        }

        if (shellOut > 0) {
            shellToken.safeTransfer(msg.sender, shellOut);
        }

        emit PlayerWithdrew(msg.sender, krillAmount, shellOut);
    }

    function claimReward() external nonReentrant onlyInitialized settlePlayer(msg.sender) {
        Player storage p = players[msg.sender];
        if (!p.isActive) revert PlayerNotActive();
        // Reward already settled in _settlePlayer, nothing extra needed
        // The settlement applies pending rewards to krillBalance
    }

    function claimVoterReward() external nonReentrant onlyInitialized settlePlayer(msg.sender) {
        Player storage p = players[msg.sender];
        if (!p.isActive) revert PlayerNotActive();
        // Voter reward settled in _settlePlayer
    }

    // ─── Purge ──────────────────────────────────────────────────────────

    function purge(address playerAddr) external nonReentrant onlyInitialized {
        _updateTreasuryYield();

        // Caller must be an active, solvent player
        if (!players[msg.sender].isActive) revert CallerNotEligible();
        if (_getEffectiveBalance(msg.sender) <= INSOLVENCY_THRESHOLD) revert CallerNotEligible();

        Player storage p = players[playerAddr];
        if (!p.isActive) revert PlayerNotActive();

        // Check target insolvency using effective balance
        if (_getEffectiveBalance(playerAddr) >= INSOLVENCY_THRESHOLD) revert PlayerNotInsolvent();

        uint256 remainingKrill = p.krillBalance;

        // 50% to caller as KRILL
        uint256 callerKrill = remainingKrill / 2;
        // 50% to treasury
        uint256 treasuryKrill = remainingKrill - callerKrill;
        treasury += treasuryKrill;

        _deactivatePlayer(playerAddr);

        // Settle caller then credit KRILL
        _settlePlayer(msg.sender);
        players[msg.sender].krillBalance += callerKrill;

        emit PlayerPurged(playerAddr, msg.sender, remainingKrill);
    }

    // ─── King Functions ─────────────────────────────────────────────────

    function setTaxRate(uint256 newRate) external onlyKing onlyInitialized {
        if (newRate < MIN_TAX_RATE || newRate > MAX_TAX_RATE) revert InvalidTaxRate();

        _updateTreasuryYield();

        previousTaxRate = taxRate;
        taxRateChangeBlock = block.number;
        taxRate = newRate;

        emit TaxRateChanged(previousTaxRate, newRate);
    }

    function distributeToAddress(address to, uint256 amount) external onlyKing onlyInitialized {
        _updateTreasuryYield();
        if (amount > treasury) revert InsufficientTreasury();

        Player storage p = players[to];
        if (!p.isActive) revert PlayerNotActive();

        _settlePlayer(to);

        treasury -= amount;
        p.krillBalance += amount;

        emit TreasuryDistribution(to, amount);
    }

    function distributeToAllPlayers(uint256 amount) external onlyKing onlyInitialized {
        _updateTreasuryYield();
        if (amount > treasury) revert InsufficientTreasury();
        if (activePlayers == 0) revert ZeroAmount();

        treasury -= amount;
        accRewardPerPlayer += (amount * REWARD_PRECISION) / activePlayers;

        emit RewardDistributed(amount);
    }

    function distributeToVoters(uint256 amount) external onlyKing onlyInitialized {
        _updateTreasuryYield();
        if (amount > treasury) revert InsufficientTreasury();

        uint256 voterCount = election.getCurrentKingVoterCount();
        if (voterCount == 0) revert ZeroAmount();

        treasury -= amount;
        accVoterRewardPerVoter += (amount * REWARD_PRECISION) / voterCount;

        emit VoterRewardDistributed(amount);
    }

    // ─── Election Functions ─────────────────────────────────────────────

    function setKing(address newKing) external onlyElection {
        address oldKing = king;
        king = newKing;

        // New epoch for voter rewards — previous epoch rewards forfeited
        voterRewardEpoch++;
        accVoterRewardPerVoter = 0;

        emit KingChanged(oldKing, newKing);
    }

    function deductKrill(address player, uint256 amount) external onlyElection {
        _settlePlayer(player);
        Player storage p = players[player];
        if (!p.isActive) revert PlayerNotActive();
        if (p.krillBalance < amount) revert InsufficientKrill();
        p.krillBalance -= amount;
    }

    function creditKrill(address player, uint256 amount) external onlyElection {
        _settlePlayer(player);
        Player storage p = players[player];
        if (!p.isActive) revert PlayerNotActive();
        p.krillBalance += amount;
    }

    function creditTreasury(uint256 amount) external onlyElection {
        treasury += amount;
    }

    // ─── View Functions ─────────────────────────────────────────────────

    function getEffectiveBalance(address addr) external view returns (uint256) {
        return _getEffectiveBalance(addr);
    }

    function pendingReward(address addr) external view returns (uint256) {
        return _pendingRewardFor(addr);
    }

    function pendingVoterReward(address addr) external view returns (uint256) {
        return _pendingVoterRewardFor(addr);
    }

    function getEffectiveTreasury() external view returns (uint256) {
        uint256 blocksSinceUpdate = block.number - lastYieldUpdateBlock;
        uint256 pendingYield = blocksSinceUpdate * YIELD_PER_BLOCK;

        uint256 remainingCap;
        if (MAX_KRILL_FROM_YIELD > totalYieldEmitted) {
            remainingCap = MAX_KRILL_FROM_YIELD - totalYieldEmitted;
        }

        if (pendingYield > remainingCap) {
            pendingYield = remainingCap;
        }

        return treasury + pendingYield;
    }

    function isInsolvent(address addr) external view returns (bool) {
        if (!players[addr].isActive) return false;
        return _getEffectiveBalance(addr) < INSOLVENCY_THRESHOLD;
    }

    function isActivePlayer(address addr) external view returns (bool) {
        return players[addr].isActive;
    }

    function getJoinedBlock(address addr) external view returns (uint64) {
        return players[addr].joinedBlock;
    }

    // ─── Internal Functions ─────────────────────────────────────────────

    function _getEffectiveBalance(address addr) internal view returns (uint256) {
        Player storage p = players[addr];
        if (!p.isActive) return 0;

        uint256 pendingTax = _calculatePendingTax(addr);
        uint256 pending = _pendingRewardFor(addr);
        uint256 voterPending = _pendingVoterRewardFor(addr);

        uint256 balance = p.krillBalance + pending + voterPending;
        if (balance <= pendingTax) return 0;
        return balance - pendingTax;
    }

    function _settlePlayer(address addr) internal {
        _updateTreasuryYield();

        Player storage p = players[addr];
        if (!p.isActive) return;

        // Apply pending tax
        uint256 pendingTax = _calculatePendingTax(addr);
        if (pendingTax > 0) {
            if (pendingTax >= p.krillBalance) {
                treasury += p.krillBalance;
                p.krillBalance = 0;
            } else {
                p.krillBalance -= pendingTax;
                treasury += pendingTax;
            }
        }

        // Apply pending rewards
        uint256 pending = _pendingRewardFor(addr);
        if (pending > 0) {
            p.krillBalance += pending;
        }
        p.rewardDebt = accRewardPerPlayer;

        // Apply pending voter rewards
        uint256 voterPending = _pendingVoterRewardFor(addr);
        if (voterPending > 0) {
            p.krillBalance += voterPending;
        }
        p.voterRewardDebt = accVoterRewardPerVoter;

        p.lastInteractionBlock = uint64(block.number);
    }

    function _calculatePendingTax(address addr) internal view returns (uint256) {
        Player storage p = players[addr];
        if (!p.isActive) return 0;

        uint64 lastBlock = p.lastInteractionBlock;
        if (block.number <= lastBlock) return 0;

        // Piecewise calculation if tax rate changed during player's idle period
        if (taxRateChangeBlock > lastBlock && taxRateChangeBlock <= block.number) {
            uint256 blocksBefore = taxRateChangeBlock - lastBlock;
            uint256 blocksAfter = block.number - taxRateChangeBlock;
            return (blocksBefore * previousTaxRate) + (blocksAfter * taxRate);
        }

        return (block.number - lastBlock) * taxRate;
    }

    function _updateTreasuryYield() internal {
        if (block.number <= lastYieldUpdateBlock) return;

        uint256 blocksSinceUpdate = block.number - lastYieldUpdateBlock;
        uint256 pendingYield = blocksSinceUpdate * YIELD_PER_BLOCK;

        uint256 remainingCap;
        if (MAX_KRILL_FROM_YIELD > totalYieldEmitted) {
            remainingCap = MAX_KRILL_FROM_YIELD - totalYieldEmitted;
        }

        if (pendingYield > remainingCap) {
            pendingYield = remainingCap;
        }

        if (pendingYield > 0) {
            treasury += pendingYield;
            totalYieldEmitted += pendingYield;
        }

        lastYieldUpdateBlock = block.number;
    }

    function _pendingRewardFor(address addr) internal view returns (uint256) {
        Player storage p = players[addr];
        if (!p.isActive) return 0;
        if (accRewardPerPlayer <= p.rewardDebt) return 0;
        return (accRewardPerPlayer - p.rewardDebt) / REWARD_PRECISION;
    }

    function _pendingVoterRewardFor(address addr) internal view returns (uint256) {
        Player storage p = players[addr];
        if (!p.isActive) return 0;

        // Check if player voted for current king
        try election.didVoteForCurrentKing(addr) returns (bool voted) {
            if (!voted) return 0;
        } catch {
            return 0;
        }

        if (accVoterRewardPerVoter <= p.voterRewardDebt) return 0;
        return (accVoterRewardPerVoter - p.voterRewardDebt) / REWARD_PRECISION;
    }

    function _deactivatePlayer(address addr) internal {
        Player storage p = players[addr];
        p.krillBalance = 0;
        p.isActive = false;
        p.rewardDebt = 0;
        p.voterRewardDebt = 0;
        activePlayers--;
    }
}
