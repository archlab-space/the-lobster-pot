// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ShellToken} from "../src/ShellToken.sol";
import {GameCore} from "../src/GameCore.sol";
import {Election} from "../src/Election.sol";

contract GameCoreTest is Test {
    ShellToken public shell;
    GameCore public game;
    Election public election;

    address public deployer = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xC4A);
    address public king;

    uint256 constant EXCHANGE_RATE = 100;
    uint256 constant ENTRY_TICKET = 30_000 * 1e18;
    uint256 constant MIN_SHELL_ENTRY = 300 * 1e18; // 300 SHELL = 30,000 KRILL
    uint256 constant INSOLVENCY_THRESHOLD = 1_000 * 1e18;

    function setUp() public {
        shell = new ShellToken();
        game = new GameCore(address(shell));
        election = new Election(address(game));
        game.initialize(address(election));

        // Fund game with SHELL for treasury yield backing
        shell.transfer(address(game), 750_000_000 * 1e18);

        // Give players some SHELL
        shell.transfer(alice, 10_000 * 1e18);
        shell.transfer(bob, 10_000 * 1e18);
        shell.transfer(charlie, 10_000 * 1e18);

        // Approve game for players
        vm.prank(alice);
        shell.approve(address(game), type(uint256).max);
        vm.prank(bob);
        shell.approve(address(game), type(uint256).max);
        vm.prank(charlie);
        shell.approve(address(game), type(uint256).max);
    }

    // ─── Entry Tests ────────────────────────────────────────────────────

    function test_Enter() public {
        vm.prank(alice);
        game.enter(500 * 1e18); // 500 SHELL = 50,000 KRILL

        assertEq(game.activePlayers(), 1);
        assertTrue(game.isActivePlayer(alice));
        // 50,000 - 30,000 ENTRY_TICKET = 20,000 KRILL
        assertEq(game.getEffectiveBalance(alice), 20_000 * 1e18);
        assertEq(game.getEffectiveTreasury(), ENTRY_TICKET);
    }

    function test_Enter_BelowEntryTicket() public {
        vm.prank(alice);
        vm.expectRevert(GameCore.BelowEntryTicket.selector);
        game.enter(100 * 1e18); // 100 SHELL = 10,000 KRILL < 30,000
    }

    function test_Enter_ExactMinimum() public {
        vm.prank(alice);
        game.enter(MIN_SHELL_ENTRY);
        assertTrue(game.isActivePlayer(alice));
        // 30,000 KRILL - 30,000 ENTRY_TICKET = 0 KRILL balance
        assertEq(game.getEffectiveBalance(alice), 0);
    }

    function test_Enter_AlreadyActive() public {
        vm.prank(alice);
        game.enter(500 * 1e18);

        vm.prank(alice);
        vm.expectRevert(GameCore.PlayerAlreadyActive.selector);
        game.enter(500 * 1e18);
    }

    // ─── Deposit Tests ──────────────────────────────────────────────────

    function test_Deposit() public {
        vm.prank(alice);
        game.enter(500 * 1e18);

        uint256 balBefore = game.getEffectiveBalance(alice);

        vm.prank(alice);
        game.deposit(100 * 1e18);

        uint256 balAfter = game.getEffectiveBalance(alice);
        // Should have gained 10,000 KRILL (100 SHELL * 100)
        // Might lose a small amount to tax on the deposit block
        assertGt(balAfter, balBefore);
    }

    function test_Deposit_NotActive() public {
        vm.prank(alice);
        vm.expectRevert(GameCore.PlayerNotActive.selector);
        game.deposit(100 * 1e18);
    }

    function test_Deposit_ZeroAmount() public {
        vm.prank(alice);
        game.enter(500 * 1e18);

        vm.prank(alice);
        vm.expectRevert(GameCore.ZeroAmount.selector);
        game.deposit(0);
    }

    // ─── Withdraw Tests ─────────────────────────────────────────────────

    function test_Withdraw() public {
        vm.prank(alice);
        game.enter(500 * 1e18);

        uint256 shellBefore = shell.balanceOf(alice);

        vm.prank(alice);
        game.withdraw(10_000 * 1e18); // Withdraw 10,000 KRILL

        uint256 shellAfter = shell.balanceOf(alice);
        // After 20% exit tax, net = 8,000 KRILL = 80 SHELL
        assertEq(shellAfter - shellBefore, 80 * 1e18);
    }

    function test_Withdraw_InsufficientKrill() public {
        vm.prank(alice);
        game.enter(500 * 1e18);

        vm.prank(alice);
        vm.expectRevert(GameCore.InsufficientKrill.selector);
        game.withdraw(100_000 * 1e18);
    }

    function test_Withdraw_FullBalance_DeactivatesPlayer() public {
        vm.prank(alice);
        game.enter(500 * 1e18); // 50,000 KRILL - 30,000 ticket = 20,000 KRILL

        // Withdraw everything (on same block, no tax)
        vm.prank(alice);
        game.withdraw(20_000 * 1e18);

        assertFalse(game.isActivePlayer(alice));
        assertEq(game.activePlayers(), 0);
    }

    function test_Withdraw_ZeroAmount() public {
        vm.prank(alice);
        game.enter(500 * 1e18);

        vm.prank(alice);
        vm.expectRevert(GameCore.ZeroAmount.selector);
        game.withdraw(0);
    }

    // ─── Tax Accumulation Tests ─────────────────────────────────────────

    function test_TaxAccumulation() public {
        vm.prank(alice);
        game.enter(500 * 1e18); // 50,000 - 30,000 ticket = 20,000 KRILL

        uint256 balAtEntry = game.getEffectiveBalance(alice);

        // Advance 100 blocks
        vm.roll(block.number + 100);

        uint256 balAfter = game.getEffectiveBalance(alice);
        // Tax = 1 KRILL/block * 100 blocks = 100 KRILL
        // Effective = 20,000 - 100 = 19,900 KRILL
        assertEq(balAtEntry - balAfter, 100 * 1e18);
    }

    function test_TaxPiecewise_OnRateChange() public {
        // Set up a king to change tax rate
        // First, we need to make someone king via election
        // For simplicity, let's use the election contract to set a king
        vm.prank(alice);
        game.enter(5000 * 1e18); // 500,000 KRILL

        vm.prank(bob);
        game.enter(500 * 1e18); // 50,000 KRILL

        // Make alice king via election
        _makeKing(alice);

        // Record bob's balance
        vm.prank(bob);
        game.claimReward(); // settle bob's state

        uint256 bobBalBefore = game.getEffectiveBalance(bob);

        // Advance 50 blocks at rate 1
        vm.roll(block.number + 50);

        // King changes rate to 3
        vm.prank(alice);
        game.setTaxRate(3 * 1e18);

        // Advance 50 more blocks at rate 3
        vm.roll(block.number + 50);

        uint256 bobBalAfter = game.getEffectiveBalance(bob);
        // Tax = 50 * 1 + 50 * 3 = 200 KRILL
        assertEq(bobBalBefore - bobBalAfter, 200 * 1e18);
    }

    // ─── Treasury Yield Tests ───────────────────────────────────────────

    function test_TreasuryYield() public {
        uint256 yieldPerBlock = 250 * 1e18;

        // Advance 100 blocks
        vm.roll(block.number + 100);

        uint256 treasury = game.getEffectiveTreasury();
        assertEq(treasury, 100 * yieldPerBlock);
    }

    function test_TreasuryYieldCap() public {
        uint256 maxYield = 750_000_000 * 100 * 1e18; // MAX_KRILL_FROM_YIELD
        uint256 yieldPerBlock = 250 * 1e18;

        // Calculate blocks to reach cap
        uint256 blocksToReachCap = maxYield / yieldPerBlock;

        // Go way past the cap
        vm.roll(block.number + blocksToReachCap + 1_000_000);

        uint256 treasury = game.getEffectiveTreasury();
        assertEq(treasury, maxYield);
    }

    // ─── Purge Tests ────────────────────────────────────────────────────

    function test_Purge_InsolventPlayer() public {
        vm.prank(alice);
        game.enter(400 * 1e18); // 40,000 - 30,000 ticket = 10,000 KRILL

        // Bob enters as a solvent player (required to call purge)
        vm.prank(bob);
        game.enter(500 * 1e18); // 50,000 - 30,000 ticket = 20,000 KRILL

        // Advance enough blocks to make alice insolvent
        // Tax = 1/block, insolvency at < 1,000 KRILL
        // Need 10,000 - 999 = 9,001 blocks
        vm.roll(block.number + 9_001);

        assertTrue(game.isInsolvent(alice));
        // Bob still solvent (20,000 - 9,001 = 10,999 > 1,000)
        assertFalse(game.isInsolvent(bob));

        vm.prank(bob);
        game.purge(alice);

        assertFalse(game.isActivePlayer(alice));
        // Bob should have received half of alice's raw krillBalance as KRILL
        // Bob's effective balance should have increased
        assertGt(game.getEffectiveBalance(bob), 0);
    }

    function test_Purge_SolventPlayer_Reverts() public {
        vm.prank(alice);
        game.enter(500 * 1e18);

        vm.prank(bob);
        game.enter(500 * 1e18);

        vm.prank(bob);
        vm.expectRevert(GameCore.PlayerNotInsolvent.selector);
        game.purge(alice);
    }

    function test_Purge_InactivePlayer_Reverts() public {
        // Bob must be active player to call purge
        vm.prank(bob);
        game.enter(500 * 1e18);

        vm.prank(bob);
        vm.expectRevert(GameCore.PlayerNotActive.selector);
        game.purge(alice);
    }

    function test_Purge_CallerNotPlayer_Reverts() public {
        vm.prank(alice);
        game.enter(400 * 1e18);

        // bob is not a player
        vm.prank(bob);
        vm.expectRevert(GameCore.CallerNotEligible.selector);
        game.purge(alice);
    }

    function test_Purge_CallerInsolvent_Reverts() public {
        vm.prank(alice);
        game.enter(400 * 1e18); // 10,000 KRILL

        vm.prank(bob);
        game.enter(400 * 1e18); // 10,000 KRILL

        // Advance blocks so both become insolvent
        vm.roll(block.number + 9_001);

        assertTrue(game.isInsolvent(alice));
        assertTrue(game.isInsolvent(bob));

        vm.prank(bob);
        vm.expectRevert(GameCore.CallerNotEligible.selector);
        game.purge(alice);
    }

    // ─── Reward Distribution Tests ──────────────────────────────────────

    function test_DistributeToAllPlayers() public {
        vm.prank(alice);
        game.enter(5000 * 1e18);
        vm.prank(bob);
        game.enter(500 * 1e18);

        _makeKing(alice);

        // Advance to build treasury
        vm.roll(block.number + 1000);

        // King distributes 10,000 KRILL to all players
        vm.prank(alice);
        game.distributeToAllPlayers(10_000 * 1e18);

        // Each player gets 5,000 KRILL (10,000 / 2 players)
        uint256 alicePending = game.pendingReward(alice);
        uint256 bobPending = game.pendingReward(bob);
        assertEq(alicePending, 5_000 * 1e18);
        assertEq(bobPending, 5_000 * 1e18);
    }

    function test_DistributeToAllPlayers_LateEntry() public {
        vm.prank(alice);
        game.enter(5000 * 1e18);

        _makeKing(alice);

        vm.roll(block.number + 100);

        // Distribute before bob enters
        vm.prank(alice);
        game.distributeToAllPlayers(10_000 * 1e18);

        // Bob enters after distribution
        vm.prank(bob);
        game.enter(500 * 1e18);

        // Bob should have 0 pending reward from the prior distribution
        uint256 bobPending = game.pendingReward(bob);
        assertEq(bobPending, 0);

        // Alice should have all 10,000
        uint256 alicePending = game.pendingReward(alice);
        assertEq(alicePending, 10_000 * 1e18);
    }

    // ─── Effective Balance View ─────────────────────────────────────────

    function test_EffectiveBalance_IncludesTaxAndRewards() public {
        vm.prank(alice);
        game.enter(500 * 1e18); // 50,000 - 30,000 ticket = 20,000 KRILL

        vm.roll(block.number + 100);

        uint256 effective = game.getEffectiveBalance(alice);
        // 20,000 - 100 (tax) = 19,900
        assertEq(effective, 19_900 * 1e18);
    }

    // ─── Access Control Tests ───────────────────────────────────────────

    function test_OnlyKing_SetTaxRate() public {
        vm.prank(alice);
        vm.expectRevert(GameCore.NotKing.selector);
        game.setTaxRate(2 * 1e18);
    }

    function test_OnlyKing_DistributeToAddress() public {
        vm.prank(alice);
        vm.expectRevert(GameCore.NotKing.selector);
        game.distributeToAddress(bob, 100);
    }

    function test_OnlyKing_DistributeToAllPlayers() public {
        vm.prank(alice);
        vm.expectRevert(GameCore.NotKing.selector);
        game.distributeToAllPlayers(100);
    }

    function test_OnlyKing_DistributeToVoters() public {
        vm.prank(alice);
        vm.expectRevert(GameCore.NotKing.selector);
        game.distributeToVoters(100);
    }

    function test_OnlyElection_SetKing() public {
        vm.prank(alice);
        vm.expectRevert(GameCore.NotElection.selector);
        game.setKing(alice);
    }

    function test_OnlyElection_DeductKrill() public {
        vm.prank(alice);
        vm.expectRevert(GameCore.NotElection.selector);
        game.deductKrill(alice, 100);
    }

    function test_OnlyElection_CreditKrill() public {
        vm.prank(alice);
        vm.expectRevert(GameCore.NotElection.selector);
        game.creditKrill(alice, 100);
    }

    function test_SetTaxRate_InvalidRate() public {
        vm.prank(alice);
        game.enter(5000 * 1e18);
        _makeKing(alice);

        vm.prank(alice);
        vm.expectRevert(GameCore.InvalidTaxRate.selector);
        game.setTaxRate(6 * 1e18); // Above MAX_TAX_RATE

        vm.prank(alice);
        vm.expectRevert(GameCore.InvalidTaxRate.selector);
        game.setTaxRate(0); // Below MIN_TAX_RATE
    }

    // ─── Voter Reward Tests ─────────────────────────────────────────────

    function test_DistributeToVoters() public {
        // Setup: alice and bob enter, alice becomes king with bob's vote
        vm.prank(alice);
        game.enter(5000 * 1e18);
        vm.prank(bob);
        game.enter(500 * 1e18);
        vm.prank(charlie);
        game.enter(500 * 1e18);

        _makeKingWithVoters(alice, bob);

        vm.roll(block.number + 1000);

        // King distributes to voters
        vm.prank(alice);
        game.distributeToVoters(5_000 * 1e18);

        // Bob voted for alice (king), so should have pending voter reward
        uint256 bobVoterReward = game.pendingVoterReward(bob);
        assertEq(bobVoterReward, 5_000 * 1e18);

        // Charlie did not vote for alice, so should have 0
        uint256 charlieVoterReward = game.pendingVoterReward(charlie);
        assertEq(charlieVoterReward, 0);
    }

    // ─── Fuzz Tests ─────────────────────────────────────────────────────

    function testFuzz_Enter_Amounts(uint256 shellAmount) public {
        // Bound to valid range: minimum entry to max alice balance
        shellAmount = bound(shellAmount, MIN_SHELL_ENTRY, 10_000 * 1e18);

        vm.prank(alice);
        game.enter(shellAmount);

        assertTrue(game.isActivePlayer(alice));
        assertEq(game.getEffectiveBalance(alice), shellAmount * EXCHANGE_RATE - ENTRY_TICKET);
    }

    function testFuzz_TaxAccumulation(uint256 blocks) public {
        blocks = bound(blocks, 1, 100_000);

        vm.prank(alice);
        game.enter(5000 * 1e18); // 500,000 - 30,000 ticket = 470,000 KRILL

        vm.roll(block.number + blocks);

        uint256 effective = game.getEffectiveBalance(alice);
        uint256 expectedTax = blocks * 1e18; // 1 KRILL/block
        uint256 expectedBalance = 470_000 * 1e18 - expectedTax;

        if (expectedBalance < INSOLVENCY_THRESHOLD) {
            // Might be insolvent
            assertTrue(effective < INSOLVENCY_THRESHOLD || effective == 0);
        } else {
            assertEq(effective, expectedBalance);
        }
    }

    function testFuzz_Withdraw_Amounts(uint256 krillAmount) public {
        vm.prank(alice);
        game.enter(5000 * 1e18); // 500,000 - 30,000 ticket = 470,000 KRILL

        krillAmount = bound(krillAmount, 1, 470_000 * 1e18);

        vm.prank(alice);
        game.withdraw(krillAmount);

        uint256 remaining = game.getEffectiveBalance(alice);
        assertEq(remaining, 470_000 * 1e18 - krillAmount);
    }

    // ─── AlreadyInitialized ─────────────────────────────────────────────

    function test_Initialize_OnlyOnce() public {
        vm.expectRevert(GameCore.AlreadyInitialized.selector);
        game.initialize(address(election));
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    function _makeKing(address who) internal {
        vm.prank(address(election));
        game.setKing(who);
    }

    function _makeKingWithVoters(address kingAddr, address voter) internal {
        // We need to simulate a full election cycle
        // First, make the kingAddr a candidate, have voter vote, finalize, advance

        uint256 regFee = 1_000_000 * 1e18;

        // Fund king candidate enough for registration
        // King already has 500,000 KRILL from enter(5000) — need more
        // Credit extra KRILL via election
        vm.prank(address(election));
        game.creditKrill(kingAddr, regFee);

        // Start campaign
        vm.prank(kingAddr);
        election.startCampaign(0);

        // Advance past voter age
        vm.roll(block.number + 101);

        // Vote
        vm.prank(voter);
        election.vote(kingAddr);

        // Advance to end of term
        vm.roll(block.number + 30_000);

        // Finalize and advance
        election.finalizeElection();
        election.advanceTerm();
    }
}
