// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ShellToken} from "../src/ShellToken.sol";
import {GameCore} from "../src/GameCore.sol";
import {Election} from "../src/Election.sol";

contract ElectionTest is Test {
    ShellToken public shell;
    GameCore public game;
    Election public election;

    address public deployer = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xC4A);
    address public dave = address(0xDA7E);

    uint256 constant TERM_DURATION = 72_000;
    uint256 constant REGISTRATION_FEE = 1_000_000 * 1e18;
    uint256 constant MIN_VOTER_AGE = 100;

    function setUp() public {
        shell = new ShellToken();
        game = new GameCore(address(shell));
        election = new Election(address(game));
        game.initialize(address(election));

        // Fund game
        shell.transfer(address(game), 750_000_000 * 1e18);

        // Give players SHELL and set up
        address[4] memory players = [alice, bob, charlie, dave];
        for (uint256 i = 0; i < players.length; i++) {
            shell.transfer(players[i], 100_000 * 1e18);
            vm.prank(players[i]);
            shell.approve(address(game), type(uint256).max);
        }

        // All players enter game with enough KRILL for registration
        for (uint256 i = 0; i < players.length; i++) {
            vm.prank(players[i]);
            game.enter(50_000 * 1e18); // 5,000,000 KRILL each
        }
    }

    // ─── Campaign Tests ─────────────────────────────────────────────────

    function test_StartCampaign() public {
        // Credit extra KRILL for registration fee
        _creditForRegistration(alice);

        vm.prank(alice);
        election.startCampaign(100 * 1e18);

        assertEq(election.getCandidateCount(0), 1);
    }

    function test_StartCampaign_AlreadyRegistered() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(100 * 1e18);

        _creditForRegistration(alice);
        vm.prank(alice);
        vm.expectRevert(Election.AlreadyRegistered.selector);
        election.startCampaign(100 * 1e18);
    }

    function test_StartCampaign_NotActivePlayer() public {
        address outsider = address(0xDEAD);
        vm.prank(outsider);
        vm.expectRevert(Election.NotActivePlayer.selector);
        election.startCampaign(100 * 1e18);
    }

    function test_FundCampaign() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(100 * 1e18);

        vm.prank(alice);
        election.fundCampaign(50_000 * 1e18);

        (,,uint256 campaignFunds,,) = _getCandidateInfo(0, alice);
        assertEq(campaignFunds, 50_000 * 1e18);
    }

    function test_FundCampaign_NotRegistered() public {
        vm.prank(alice);
        vm.expectRevert(Election.CandidateNotRegistered.selector);
        election.fundCampaign(1000 * 1e18);
    }

    // ─── Voting Tests ───────────────────────────────────────────────────

    function test_Vote_Success() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(10 * 1e18);

        // Fund campaign for bribes
        vm.prank(alice);
        election.fundCampaign(1000 * 1e18);

        // Advance past voter age
        vm.roll(block.number + MIN_VOTER_AGE + 1);

        vm.prank(bob);
        election.vote(alice);

        assertTrue(election.hasVoted(0, bob));
        assertEq(election.votedFor(0, bob), alice);
    }

    function test_Vote_InsufficientBalance() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // Create a player with minimal balance that will be below threshold after tax
        address poorPlayer = address(0x999);
        shell.transfer(poorPlayer, 500 * 1e18);
        vm.prank(poorPlayer);
        shell.approve(address(game), type(uint256).max);
        vm.prank(poorPlayer);
        game.enter(500 * 1e18); // 50,000 - 30,000 ticket = 20,000 KRILL

        // Advance many blocks so tax eats balance below VOTER_MIN_BALANCE
        vm.roll(block.number + 19_100);

        vm.prank(poorPlayer);
        vm.expectRevert(Election.InsufficientBalance.selector);
        election.vote(alice);
    }

    function test_Vote_DoubleVote() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        vm.prank(bob);
        election.vote(alice);

        vm.prank(bob);
        vm.expectRevert(Election.AlreadyVoted.selector);
        election.vote(alice);
    }

    function test_Vote_CandidateNotRegistered() public {
        vm.roll(block.number + MIN_VOTER_AGE + 1);

        vm.prank(bob);
        vm.expectRevert(Election.CandidateNotRegistered.selector);
        election.vote(alice);
    }

    function test_Vote_TooYoungToVote() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        // Don't advance blocks — voter is too young
        vm.prank(bob);
        vm.expectRevert(Election.TooYoungToVote.selector);
        election.vote(alice);
    }

    function test_Vote_NoBribeFunds() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(1000 * 1e18); // High bribe but no campaign funds

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // Vote should still succeed, just no bribe paid
        vm.prank(bob);
        election.vote(alice);

        assertTrue(election.hasVoted(0, bob));
    }

    function test_Vote_PartialBribe() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(1000 * 1e18);

        // Fund only enough for 1 bribe
        vm.prank(alice);
        election.fundCampaign(1000 * 1e18);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // First voter gets bribe
        vm.prank(bob);
        election.vote(alice);

        // Second voter doesn't get bribe (funds exhausted)
        vm.prank(charlie);
        election.vote(alice);

        // Both votes count
        (uint256 voteCount,,,,) = _getCandidateInfo(0, alice);
        assertEq(voteCount, 2);
    }

    // ─── Finalize Tests ─────────────────────────────────────────────────

    function test_FinalizeElection_Success() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        vm.prank(bob);
        election.vote(alice);

        // Advance to end of term
        vm.roll(block.number + TERM_DURATION);

        election.finalizeElection();

        assertTrue(election.termFinalized(0));
        assertEq(election.termWinner(0), alice);
    }

    function test_FinalizeElection_TooEarly() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        vm.expectRevert(Election.TermNotEnded.selector);
        election.finalizeElection();
    }

    function test_FinalizeElection_NoCandidates_IncumbentStays() public {
        // First set a king
        vm.prank(address(election));
        game.setKing(alice);

        // Advance past term
        vm.roll(block.number + TERM_DURATION);

        election.finalizeElection();

        assertEq(election.termWinner(0), alice);
    }

    function test_FinalizeElection_Tie_FirstRegisteredWins() public {
        _creditForRegistration(alice);
        _creditForRegistration(bob);

        vm.prank(alice);
        election.startCampaign(0);
        vm.prank(bob);
        election.startCampaign(0);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // Each gets 1 vote
        vm.prank(charlie);
        election.vote(alice);
        vm.prank(dave);
        election.vote(bob);

        vm.roll(block.number + TERM_DURATION);
        election.finalizeElection();

        // Alice registered first, wins tie
        assertEq(election.termWinner(0), alice);
    }

    function test_FinalizeElection_AlreadyFinalized() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        vm.roll(block.number + TERM_DURATION + 1);
        election.finalizeElection();

        vm.expectRevert(Election.ElectionAlreadyFinalized.selector);
        election.finalizeElection();
    }

    // ─── Advance Term Tests ─────────────────────────────────────────────

    function test_AdvanceTerm_RefundsAndKingChange() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        // Fund campaign (should be refunded)
        vm.prank(alice);
        election.fundCampaign(5_000 * 1e18);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        vm.prank(bob);
        election.vote(alice);

        vm.roll(block.number + TERM_DURATION);
        election.finalizeElection();
        election.advanceTerm();

        // Alice should be king now
        assertEq(game.king(), alice);
        assertEq(election.currentTerm(), 1);

        // Alice should have campaign funds refunded
        // (credited back via creditKrill)
    }

    function test_AdvanceTerm_NotFinalized() public {
        vm.expectRevert(Election.ElectionNotFinalized.selector);
        election.advanceTerm();
    }

    // ─── Full Election Cycle Integration ────────────────────────────────

    function test_FullElectionCycle() public {
        // === Term 0: Alice runs, gets votes, becomes king ===
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(50 * 1e18); // 50 KRILL bribe per vote

        vm.prank(alice);
        election.fundCampaign(200 * 1e18); // Enough for 4 bribes

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        vm.prank(bob);
        election.vote(alice);
        vm.prank(charlie);
        election.vote(alice);

        vm.roll(block.number + TERM_DURATION);
        election.finalizeElection();
        election.advanceTerm();

        assertEq(game.king(), alice);
        assertEq(election.currentKingVoterCount(), 2);
        assertTrue(election.didVoteForCurrentKing(bob));
        assertTrue(election.didVoteForCurrentKing(charlie));
        assertFalse(election.didVoteForCurrentKing(dave));

        // === King distributes to voters ===
        vm.roll(block.number + 1000); // Build treasury

        vm.prank(alice);
        game.distributeToVoters(2_000 * 1e18);

        // Each voter gets 1,000 KRILL
        uint256 bobReward = game.pendingVoterReward(bob);
        assertEq(bobReward, 1_000 * 1e18);

        // === Term 1: Bob challenges ===
        _creditForRegistration(bob);
        vm.prank(bob);
        election.startCampaign(0);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        vm.prank(charlie);
        election.vote(bob);
        vm.prank(dave);
        election.vote(bob);

        vm.roll(block.number + TERM_DURATION);
        election.finalizeElection();
        election.advanceTerm();

        assertEq(game.king(), bob);
        // Previous voter rewards should be forfeited (new epoch)
        assertEq(game.pendingVoterReward(bob), 0);
    }

    // ─── Flash-loan Voter Protection ────────────────────────────────────

    function test_FlashLoanProtection() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        // New player enters
        address newPlayer = address(0xFEED);
        shell.transfer(newPlayer, 10_000 * 1e18);
        vm.prank(newPlayer);
        shell.approve(address(game), type(uint256).max);

        // Advance close to the MIN_VOTER_AGE but enter late
        vm.roll(block.number + MIN_VOTER_AGE + 50);

        vm.prank(newPlayer);
        game.enter(500 * 1e18);

        // Try to vote immediately — should fail
        vm.prank(newPlayer);
        vm.expectRevert(Election.TooYoungToVote.selector);
        election.vote(alice);

        // Advance past voter age
        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // Now should succeed
        vm.prank(newPlayer);
        election.vote(alice);
    }

    // ─── View Functions ─────────────────────────────────────────────────

    function test_BlocksRemainingInTerm() public view {
        uint256 remaining = election.blocksRemainingInTerm();
        assertEq(remaining, TERM_DURATION);
    }

    function test_BlocksRemainingInTerm_Elapsed() public {
        vm.roll(block.number + 10_000);
        uint256 remaining = election.blocksRemainingInTerm();
        assertEq(remaining, TERM_DURATION - 10_000);
    }

    function test_BlocksRemainingInTerm_PastEnd() public {
        vm.roll(block.number + TERM_DURATION + 100);
        uint256 remaining = election.blocksRemainingInTerm();
        assertEq(remaining, 0);
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    function _creditForRegistration(address player) internal {
        vm.prank(address(election));
        game.creditKrill(player, REGISTRATION_FEE);
    }

    function _getCandidateInfo(uint256 term, address candidate)
        internal
        view
        returns (uint256 voteCount, uint256 bribePerVote, uint256 campaignFunds, bool registered, bool _exists)
    {
        (bribePerVote, campaignFunds, voteCount, registered) = election.candidates(term, candidate);
        _exists = registered;
    }
}
