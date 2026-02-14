// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IElection} from "./interfaces/IElection.sol";

contract GameCore is Initializable, ReentrancyGuard, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // ─── Constitution Constants ─────────────────────────────────────────
    uint256 public constant EXCHANGE_RATE = 100;
    uint256 public constant EXIT_TAX_BPS = 2000;
    uint256 public constant ENTRY_TICKET = 30_000 * 1e18;
    uint256 public constant INSOLVENCY_THRESHOLD = 1_000 * 1e18;
    uint256 public constant YIELD_PER_BLOCK = 200 * 1e18;
    uint256 public constant MIN_TAX_RATE = 1 * 1e18;
    uint256 public constant MAX_TAX_RATE = 5 * 1e18;
    uint256 public constant MAX_KRILL_FROM_YIELD = 750_000_000 * EXCHANGE_RATE * 1e18;
    uint256 public constant DELINQUENCY_GRACE_PERIOD = 18000; // ~2 hour
    uint256 public constant DELINQUENCY_BOUNTY_BPS = 1000;   // 10% of pending tax
    uint256 internal constant REWARD_PRECISION = 1e18;

    // ─── Player Struct ──────────────────────────────────────────────────
    struct Player {
        uint256 krillBalance;
        uint256 rewardDebt;
        uint256 voterRewardDebt;
        uint256 voterRewardEpochSnapshot;
        uint64 lastTaxBlock;
        uint64 joinedBlock;
        uint32 entryCount;
        bool isActive;
    }

    // ─── State ──────────────────────────────────────────────────────────
    IERC20 public shellToken;
    IElection public election;
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

    // Voter reward distribution (term-based)
    uint256 public lastVoterRewardTerm;
    uint256 public accVoterRewardPerVoter;

    // ─── Storage Gap ────────────────────────────────────────────────────
    uint256[50] private __gap;

    // ─── Events ─────────────────────────────────────────────────────────
    event PlayerEntered(address indexed player, uint256 shellAmount, uint256 krillBalance, uint32 entryCount, uint256 treasury, uint256 activePlayers);
    event PlayerDeposited(address indexed player, uint256 shellAmount, uint256 krillBalance);
    event PlayerWithdrew(address indexed player, uint256 remainingKrill, uint256 shellReceived, uint256 treasury);
    event PlayerPurged(address indexed player, address indexed purger, uint256 purgerKrillBalance, uint256 treasury);
    event TaxRateChanged(uint256 oldRate, uint256 newRate, uint256 currentTerm, address currentKing, uint256 treasury);
    event TreasuryDistribution(address indexed to, uint256 amount, uint256 recipientKrillBalance, uint256 currentTerm, address currentKing, uint256 treasury);
    event RewardDistributed(uint256 amount, uint256 perPlayer, uint256 currentTerm, address currentKing, uint256 treasury);
    event VoterRewardDistributed(uint256 amount, uint256 perVoter, uint256 currentTerm, address currentKing, uint256 treasury);
    event RewardClaimed(address indexed player, uint256 claimedAmount, uint256 krillBalance, uint256 treasury);
    event taxSettled(address indexed player, uint256 taxPaid, uint256 remainingKrill, uint256 treasury);
    event DelinquentSettled(address indexed player, address indexed settler, uint256 remainingKrill, uint256 settlerKrillBalance, uint256 treasury);
    event PlayerDeactivated(address indexed player, uint256 activePlayers);
    event GameInitialized(address indexed election, uint256 startBlock);
    event TreasuryCredited(uint256 amount, uint256 treasury);

    event KrillDeducted(address indexed player, uint256 amount, uint256 remainingKrill);
    event KrillCredited(address indexed player, uint256 amount, uint256 krillBalance);

    // ─── Errors ─────────────────────────────────────────────────────────
    error ElectionAlreadySet();
    error NotInitialized();
    error NotKing();
    error IsKing();
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
    error PlayerNotDelinquent();
    error CannotSettleSelf();

    // ─── Modifiers ──────────────────────────────────────────────────────
    modifier onlyKing() {
        if (msg.sender != king()) revert NotKing();
        _;
    }

    modifier onlyNotKing() {
        if (msg.sender == king()) revert IsKing();
        _;
    }

    modifier onlyElection() {
        if (msg.sender != address(election)) revert NotElection();
        _;
    }

    modifier onlyInitialized() {
        if (address(election) == address(0)) revert NotInitialized();
        _;
    }

    modifier settlePlayer(address addr) {
        _settlePlayer(addr);
        _;
    }

    // ─── Constructor (disabled for proxy) ────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─── Initialization ─────────────────────────────────────────────────
    function initialize(address _shellToken, address _election, address _owner) external initializer {
        __Ownable_init(_owner);
        __Pausable_init();
        shellToken = IERC20(_shellToken);
        election = IElection(_election);
        gameStartBlock = block.number;
        lastYieldUpdateBlock = block.number;
        taxRateChangeBlock = block.number;
        taxRate = MIN_TAX_RATE;
        previousTaxRate = MIN_TAX_RATE;
        emit GameInitialized(_election, block.number);
    }

    function setElection(address _election) external onlyOwner {
        if (address(election) != address(0)) revert ElectionAlreadySet();
        election = IElection(_election);
    }

    // ─── Player Functions ───────────────────────────────────────────────

    function enter(uint256 shellAmount) external nonReentrant onlyInitialized whenNotPaused {
        Player storage p = players[msg.sender];
        if (p.isActive) revert PlayerAlreadyActive();

        uint256 krillAmount = shellAmount * EXCHANGE_RATE;
        if (krillAmount < ENTRY_TICKET) revert BelowEntryTicket();

        shellToken.safeTransferFrom(msg.sender, address(this), shellAmount);

        _updateTreasuryYield();

        p.krillBalance = krillAmount - ENTRY_TICKET;
        treasury += ENTRY_TICKET;
        p.lastTaxBlock = uint64(block.number);
        p.joinedBlock = uint64(block.number);
        ++p.entryCount;
        p.isActive = true;
        p.rewardDebt = accRewardPerPlayer;
        p.voterRewardDebt = accVoterRewardPerVoter;
        p.voterRewardEpochSnapshot = election.currentTerm();

        ++activePlayers;

        emit PlayerEntered(msg.sender, shellAmount, p.krillBalance, p.entryCount, treasury, activePlayers);
    }

    function deposit(uint256 shellAmount) external nonReentrant onlyInitialized whenNotPaused settlePlayer(msg.sender) {
        if (shellAmount == 0) revert ZeroAmount();
        Player storage p = players[msg.sender];
        if (!p.isActive) revert PlayerNotActive();

        uint256 krillAmount = shellAmount * EXCHANGE_RATE;
        shellToken.safeTransferFrom(msg.sender, address(this), shellAmount);

        p.krillBalance += krillAmount;

        emit PlayerDeposited(msg.sender, shellAmount, p.krillBalance);
    }

    function withdraw(uint256 krillAmount) external nonReentrant onlyInitialized whenNotPaused settlePlayer(msg.sender) {
        if (krillAmount == 0) revert ZeroAmount();
        Player storage p = players[msg.sender];
        if (!p.isActive) revert PlayerNotActive();
        if (p.krillBalance < krillAmount) revert InsufficientKrill();

        _updateTreasuryYield();

        uint256 taxAmount = (krillAmount * EXIT_TAX_BPS) / 10000;

        uint256 burnAmount = taxAmount / 2;
        uint256 treasuryAmount = taxAmount - burnAmount;

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

        if (p.krillBalance == 0) {
            _deactivatePlayer(msg.sender);
        }

        if (shellOut > 0) {
            shellToken.safeTransfer(msg.sender, shellOut);
        }

        emit PlayerWithdrew(msg.sender, p.krillBalance, shellOut, treasury);
    }

    function settleTax() external nonReentrant onlyInitialized whenNotPaused {
        Player storage p = players[msg.sender];
        if (!p.isActive) revert PlayerNotActive();
        _updateTreasuryYield();
        _settleTax(msg.sender);
    }

    function claimReward() external nonReentrant onlyInitialized whenNotPaused {
        Player storage p = players[msg.sender];
        if (!p.isActive) revert PlayerNotActive();
        _updateTreasuryYield();
        _claimRewards(msg.sender);
    }

    // ─── Purge ──────────────────────────────────────────────────────────

    function purge(address playerAddr) external nonReentrant onlyInitialized whenNotPaused {
        // Caller must be an active, solvent player
        if (!players[msg.sender].isActive) revert CallerNotEligible();

        Player storage p = players[playerAddr];
        if (!p.isActive) revert PlayerNotActive();

        // Check target insolvency using effective balance
        if (p.krillBalance >= INSOLVENCY_THRESHOLD) revert PlayerNotInsolvent();

        _updateTreasuryYield();

        uint256 remainingKrill = p.krillBalance;

        // 50% to caller as KRILL
        uint256 callerKrill = remainingKrill / 2;
        // 50% to treasury
        uint256 treasuryKrill = remainingKrill - callerKrill;
        treasury += treasuryKrill;

        _deactivatePlayer(playerAddr);

        players[msg.sender].krillBalance += callerKrill;

        emit PlayerPurged(playerAddr, msg.sender, players[msg.sender].krillBalance, treasury);
    }

    // ─── Settle Delinquent ──────────────────────────────────────────────

    function settleDelinquent(address playerAddr) external nonReentrant onlyNotKing() onlyInitialized whenNotPaused {
        if (msg.sender == playerAddr) revert CannotSettleSelf();
        if (!players[msg.sender].isActive) revert CallerNotEligible();

        Player storage p = players[playerAddr];
        if (!p.isActive) revert PlayerNotActive();
        if (block.number - p.lastTaxBlock <= DELINQUENCY_GRACE_PERIOD) revert PlayerNotDelinquent();

        _updateTreasuryYield();

        // Calculate bounty BEFORE settlement (pendingTax uses lastTaxBlock)
        uint256 pendingTax = _calculatePendingTax(playerAddr);
        if (pendingTax > p.krillBalance) {
            pendingTax = p.krillBalance;
        }

        uint256 bounty = (pendingTax * DELINQUENCY_BOUNTY_BPS) / 10000;

        p.krillBalance -= pendingTax;

        players[msg.sender].krillBalance += bounty;

        treasury += (pendingTax - bounty);

        p.lastTaxBlock = uint64(block.number);

        // If player balance drops below insolvency, deactivate
        if (p.krillBalance == 0) {
            _deactivatePlayer(playerAddr);
        }

        emit DelinquentSettled(playerAddr, msg.sender, p.krillBalance, players[msg.sender].krillBalance, treasury);
    }

    // ─── King Functions ─────────────────────────────────────────────────

    function setTaxRate(uint256 newRate) external onlyKing onlyInitialized whenNotPaused {
        if (newRate < MIN_TAX_RATE || newRate > MAX_TAX_RATE) revert InvalidTaxRate();

        _updateTreasuryYield();

        previousTaxRate = taxRate;
        taxRateChangeBlock = block.number;
        taxRate = newRate;

        emit TaxRateChanged(previousTaxRate, newRate, election.currentTerm(), election.getCurrentKing(), treasury);
    }

    function distributeToAddress(address to, uint256 amount) external onlyKing onlyInitialized whenNotPaused {
        _updateTreasuryYield();
        if (amount > treasury) revert InsufficientTreasury();

        Player storage p = players[to];
        if (!p.isActive) revert PlayerNotActive();

        treasury -= amount;
        p.krillBalance += amount;

        emit TreasuryDistribution(to, amount, p.krillBalance, election.currentTerm(), election.getCurrentKing(), treasury);
    }

    function distributeToAllPlayers(uint256 amount) external onlyKing onlyInitialized whenNotPaused {
        _updateTreasuryYield();
        if (amount > treasury) revert InsufficientTreasury();
        if (activePlayers == 0) revert ZeroAmount();

        treasury -= amount;
        uint256 perPlayer = (amount * REWARD_PRECISION) / activePlayers;
        accRewardPerPlayer += perPlayer;

        emit RewardDistributed(amount, perPlayer, election.currentTerm(), election.getCurrentKing(), treasury);
    }

    function distributeToVoters(uint256 amount) external onlyKing onlyInitialized whenNotPaused {
        _updateTreasuryYield();
        if (amount > treasury) revert InsufficientTreasury();

        uint256 currentElectionTerm = election.currentTerm();
        if (currentElectionTerm == 0) revert ZeroAmount(); // No voters in term 0

        // If term changed since last distribution, reset accumulator
        if (currentElectionTerm != lastVoterRewardTerm) {
            accVoterRewardPerVoter = 0;
            lastVoterRewardTerm = currentElectionTerm;
        }

        uint256 voterCount = election.getCurrentKingVoterCount();
        if (voterCount == 0) revert ZeroAmount();

        treasury -= amount;
        uint256 perPlayer = (amount * REWARD_PRECISION) / voterCount;
        accVoterRewardPerVoter += perPlayer;

        emit VoterRewardDistributed(amount, perPlayer, election.currentTerm(), election.getCurrentKing(), treasury);
    }

    // ─── Election Functions ─────────────────────────────────────────────

    function deductKrill(address player, uint256 amount) external onlyElection whenNotPaused {
        Player storage p = players[player];
        if (!p.isActive) revert PlayerNotActive();
        if (p.krillBalance < amount) revert InsufficientKrill();
        p.krillBalance -= amount;

        emit KrillDeducted(player, amount, p.krillBalance);
    }

    function creditKrill(address player, uint256 amount) external onlyElection whenNotPaused {
        Player storage p = players[player];
        if (!p.isActive) revert PlayerNotActive();
        p.krillBalance += amount;

        emit KrillCredited(player, amount, p.krillBalance);
    }

    function creditTreasury(uint256 amount) external onlyElection whenNotPaused {
        treasury += amount;

        emit TreasuryCredited(amount, treasury);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdrawShell() external onlyOwner whenPaused {
        uint256 balance = shellToken.balanceOf(address(this));
        shellToken.safeTransfer(owner(), balance);
    }

    // ─── UUPS ───────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ─── View Functions ─────────────────────────────────────────────────

    function activePlayerCount() external view returns (uint256) {
        return activePlayers;
    }

    function king() public view returns (address) {
        return election.getCurrentKing();
    }

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
        return players[addr].krillBalance < INSOLVENCY_THRESHOLD;
    }

    function krillBalanceOf(address addr) external view returns (uint256) {
        if (!players[addr].isActive) return 0;
        return players[addr].krillBalance;
    }

    function isDelinquent(address addr) external view returns (bool) {
        Player storage p = players[addr];
        if (!p.isActive) return false;
        return block.number - p.lastTaxBlock > DELINQUENCY_GRACE_PERIOD;
    }

    function isActivePlayer(address addr) external view returns (bool) {
        return players[addr].isActive;
    }

    function getJoinedBlock(address addr) external view returns (uint64) {
        return players[addr].joinedBlock;
    }

    function getEntryCount(address addr) external view returns (uint32) {
        return players[addr].entryCount;
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

    function _settleTax(address addr) internal {
        Player storage p = players[addr];
        if (!p.isActive) return;

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
        p.lastTaxBlock = uint64(block.number);

        emit taxSettled(addr, pendingTax, p.krillBalance, treasury);
    }

    function _claimRewards(address addr) internal {
        Player storage p = players[addr];
        if (!p.isActive) return;

        uint256 pending = _pendingRewardFor(addr);
        if (pending > 0) {
            p.krillBalance += pending;
        }
        p.rewardDebt = accRewardPerPlayer;

        uint256 voterPending = _pendingVoterRewardFor(addr);
        if (voterPending > 0) {
            p.krillBalance += voterPending;
        }
        p.voterRewardDebt = accVoterRewardPerVoter;
        p.voterRewardEpochSnapshot = election.currentTerm(); // Store current term

        emit RewardClaimed(addr, pending + voterPending, p.krillBalance, treasury);
    }

    function _settlePlayer(address addr) internal {
        _updateTreasuryYield();
        _claimRewards(addr);
        _settleTax(addr);
    }

    function _calculatePendingTax(address addr) internal view returns (uint256) {
        Player storage p = players[addr];
        if (!p.isActive) return 0;

        uint64 lastBlock = p.lastTaxBlock;
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

        uint256 currentElectionTerm = election.currentTerm();

        // Check if player voted for current king in the previous term
        try election.didVoteForCurrentKing(addr) returns (bool voted) {
            if (!voted) return 0;
        } catch {
            return 0;
        }

        // Rewards reset when term changes
        uint256 debt = (p.voterRewardEpochSnapshot == currentElectionTerm) ? p.voterRewardDebt : 0;
        if (accVoterRewardPerVoter <= debt) return 0;
        return (accVoterRewardPerVoter - debt) / REWARD_PRECISION;
    }

    function _deactivatePlayer(address addr) internal {
        Player storage p = players[addr];
        p.krillBalance = 0;
        p.isActive = false;
        p.rewardDebt = 0;
        p.voterRewardDebt = 0;
        p.voterRewardEpochSnapshot = 0;
        activePlayers--;

        emit PlayerDeactivated(addr, activePlayers);
    }
}
