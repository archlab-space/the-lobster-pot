// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
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

        // Deploy implementations
        GameCore gameImpl = new GameCore();
        Election electionImpl = new Election();

        // Deploy GameCore proxy (election=address(0) initially)
        game = GameCore(address(new ERC1967Proxy(
            address(gameImpl),
            abi.encodeWithSelector(GameCore.initialize.selector, address(shell), address(0), address(this))
        )));

        // Deploy Election proxy
        election = Election(address(new ERC1967Proxy(
            address(electionImpl),
            abi.encodeWithSelector(Election.initialize.selector, address(game), address(this))
        )));

        // Set election on GameCore
        game.setElection(address(election));

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

    function test_UpdateBribePerVote_Success() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(100 * 1e18);

        vm.prank(alice);
        election.updateBribePerVote(200 * 1e18);

        (uint256 bribePerVote,,,) = election.candidates(0, alice);
        assertEq(bribePerVote, 200 * 1e18);
    }

    function test_UpdateBribePerVote_EmitsEvent() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(100 * 1e18);

        vm.expectEmit(true, true, false, true);
        emit Election.BribePerVoteUpdated(0, alice, 100 * 1e18, 200 * 1e18);

        vm.prank(alice);
        election.updateBribePerVote(200 * 1e18);
    }

    function test_UpdateBribePerVote_NotRegistered() public {
        vm.prank(alice);
        vm.expectRevert(Election.CandidateNotRegistered.selector);
        election.updateBribePerVote(100 * 1e18);
    }

    function test_UpdateBribePerVote_NotActivePlayer() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(100 * 1e18);
        vm.prank(alice);
        election.fundCampaign(4_970_000 * 1e18);

        // Purge alice from the game
        vm.prank(bob);
        game.purge(alice);

        vm.prank(alice);
        vm.expectRevert(Election.NotActivePlayer.selector);
        election.updateBribePerVote(200 * 1e18);
    }

    function test_UpdateBribePerVote_CannotDecrease() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(100 * 1e18);

        vm.prank(alice);
        vm.expectRevert(Election.BribeCannotDecrease.selector);
        election.updateBribePerVote(50 * 1e18);
    }

    function test_UpdateBribePerVote_CanIncreaseFromZero() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        vm.prank(alice);
        election.updateBribePerVote(100 * 1e18);

        (uint256 bribePerVote,,,) = election.candidates(0, alice);
        assertEq(bribePerVote, 100 * 1e18);
    }

    function test_UpdateBribePerVote_CanIncreaseFromNonZero() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(50 * 1e18);

        vm.prank(alice);
        election.updateBribePerVote(150 * 1e18);

        (uint256 bribePerVote,,,) = election.candidates(0, alice);
        assertEq(bribePerVote, 150 * 1e18);
    }

    function test_UpdateBribePerVote_VoteBehavior() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(50 * 1e18);

        // Fund campaign for bribes
        vm.prank(alice);
        election.fundCampaign(1000 * 1e18);

        // Advance past voter age
        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // Bob votes and receives old bribe (50)
        uint256 bobBalanceBefore = game.krillBalanceOf(bob);
        vm.prank(bob);
        election.vote(alice);
        uint256 bobBalanceAfter = game.krillBalanceOf(bob);
        assertEq(bobBalanceAfter - bobBalanceBefore, 50 * 1e18);

        // Alice updates bribe
        vm.prank(alice);
        election.updateBribePerVote(100 * 1e18);

        // Charlie votes and receives new bribe (100)
        uint256 charlieBalanceBefore = game.krillBalanceOf(charlie);
        vm.prank(charlie);
        election.vote(alice);
        uint256 charlieBalanceAfter = game.krillBalanceOf(charlie);
        assertEq(charlieBalanceAfter - charlieBalanceBefore, 100 * 1e18);
    }

    function test_UpdateBribePerVote_SameValue() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(100 * 1e18);

        // Update to same value should succeed (no-op)
        vm.prank(alice);
        election.updateBribePerVote(100 * 1e18);

        (uint256 bribePerVote,,,) = election.candidates(0, alice);
        assertEq(bribePerVote, 100 * 1e18);
    }

    function test_UpdateBribePerVote_MultipleIncreases() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(50 * 1e18);

        vm.prank(alice);
        election.updateBribePerVote(100 * 1e18);

        vm.prank(alice);
        election.updateBribePerVote(150 * 1e18);

        vm.prank(alice);
        election.updateBribePerVote(200 * 1e18);

        (uint256 bribePerVote,,,) = election.candidates(0, alice);
        assertEq(bribePerVote, 200 * 1e18);
    }

    function test_UpdateBribePerVote_InsufficientFundsReverts() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(50 * 1e18);

        // Fund with small amount
        vm.prank(alice);
        election.fundCampaign(10 * 1e18);

        // Update to higher bribe (succeeds even though funds are insufficient)
        vm.prank(alice);
        election.updateBribePerVote(1000 * 1e18);

        (uint256 bribePerVote,,,) = election.candidates(0, alice);
        assertEq(bribePerVote, 1000 * 1e18);

        // Advance past voter age and vote
        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // Bob's vote should revert (insufficient funds)
        vm.prank(bob);
        vm.expectRevert(Election.InsufficientCampaignFunds.selector);
        election.vote(alice);
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
        game.settleTax();

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

        // Vote should revert due to insufficient funds
        vm.prank(bob);
        vm.expectRevert(Election.InsufficientCampaignFunds.selector);
        election.vote(alice);
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

        // Second voter should revert (funds exhausted)
        vm.prank(charlie);
        vm.expectRevert(Election.InsufficientCampaignFunds.selector);
        election.vote(alice);

        // Only first vote counted
        (uint256 voteCount,,,,) = _getCandidateInfo(0, alice);
        assertEq(voteCount, 1);
    }

    function test_Vote_ZeroBribeWithNoFunds() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0); // Zero bribe per vote

        // Don't fund campaign at all (0 funds)

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // Vote should succeed even with no funds (bribePerVote is 0)
        vm.prank(bob);
        election.vote(alice);

        assertTrue(election.hasVoted(0, bob));
        assertEq(election.votedFor(0, bob), alice);
    }

    // ─── Real-Time King Tracking Tests ──────────────────────────────────

    function test_KingChangesAutomaticallyOnTermBoundary() public {
        // Alice wins term 0
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(0);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        vm.prank(bob);
        election.vote(alice);

        // Before term ends: no king yet (getCurrentKing returns term -1's leader)
        assertEq(election.getCurrentKing(), address(0));
        assertEq(game.king(), address(0));

        // After term ends (roll to term 1): alice becomes king
        vm.roll(block.number + TERM_DURATION);

        assertEq(election.getCurrentKing(), alice);
        assertEq(game.king(), alice);
    }

    function test_LeadingCandidateTrackedRealTime() public {
        _creditForRegistration(alice);
        _creditForRegistration(bob);

        vm.prank(alice);
        election.startCampaign(0);
        vm.prank(bob);
        election.startCampaign(0);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // Charlie votes for Alice → alice is leading
        vm.prank(charlie);
        election.vote(alice);
        assertEq(election.leadingCandidate(0), alice);
        assertEq(election.leadingVoteCount(0), 1);

        // Dave votes for Bob → bob is leading (tie broken by who reached vote count first)
        vm.prank(dave);
        election.vote(bob);
        assertEq(election.leadingCandidate(0), alice); // Alice still leads (reached 1 first)
        assertEq(election.leadingVoteCount(0), 1);
    }

    function test_TieBreaking_FirstToReachVoteCountWins() public {
        _creditForRegistration(alice);
        _creditForRegistration(bob);

        // Alice campaigns first, Bob campaigns second
        vm.prank(alice);
        election.startCampaign(0);
        vm.prank(bob);
        election.startCampaign(0);

        vm.roll(block.number + MIN_VOTER_AGE + 1);

        // Charlie votes for Alice → alice leads with 1 vote
        vm.prank(charlie);
        election.vote(alice);
        assertEq(election.leadingCandidate(0), alice);

        // Dave votes for Bob → tie at 1 vote each, but alice still leads
        vm.prank(dave);
        election.vote(bob);
        assertEq(election.leadingCandidate(0), alice);

        // Roll to term 1
        vm.roll(block.number + TERM_DURATION);

        // Verify alice is king
        assertEq(election.getCurrentKing(), alice);
    }

    function test_NoCandidates_NoKing() public {
        // Don't create any candidates for term 0
        // Roll to term 1
        vm.roll(block.number + TERM_DURATION);

        // Verify no king from term 0
        assertEq(election.getCurrentKing(), address(0));
        assertEq(game.king(), address(0));
    }

    function test_CampaignFundsReclaimAfterTermEnds() public {
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(100 * 1e18);

        // Fund campaign
        vm.prank(alice);
        election.fundCampaign(5_000 * 1e18);

        uint256 aliceBalanceBefore = game.krillBalanceOf(alice);

        // Try to reclaim before term ends
        vm.prank(alice);
        vm.expectRevert(Election.TermNotEnded.selector);
        election.reclaimCampaignFunds(0);

        // Roll to term 1
        vm.roll(block.number + TERM_DURATION);

        // Reclaim succeeds
        vm.prank(alice);
        election.reclaimCampaignFunds(0);

        uint256 aliceBalanceAfter = game.krillBalanceOf(alice);
        assertEq(aliceBalanceAfter - aliceBalanceBefore, 5_000 * 1e18);
    }

    // ─── Full Election Cycle Integration ────────────────────────────────

    function test_FullElectionCycle() public {
        // === Term 0: Alice runs, gets votes ===
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

        // === Term 1 begins: Alice automatically becomes king ===
        vm.roll(block.number + TERM_DURATION);

        assertEq(election.getCurrentKing(), alice);
        assertEq(game.king(), alice);
        assertEq(election.getCurrentKingVoterCount(), 2);
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

        // === Term 2 begins: Bob automatically becomes king ===
        vm.roll(block.number + TERM_DURATION);

        assertEq(election.getCurrentKing(), bob);
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

    function test_BlocksRemainingInTerm_InNextTerm() public {
        vm.roll(block.number + TERM_DURATION + 100);
        uint256 remaining = election.blocksRemainingInTerm();
        assertEq(remaining, TERM_DURATION - 100);
    }

    // ─── Upgrade Tests ──────────────────────────────────────────────────

    function test_Election_Upgrade_OnlyOwner() public {
        Election newImpl = new Election();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, alice));
        election.upgradeToAndCall(address(newImpl), "");
    }

    function test_Election_Upgrade_PreservesState() public {
        // Create a campaign first
        _creditForRegistration(alice);
        vm.prank(alice);
        election.startCampaign(100 * 1e18);

        uint256 candidateCount = election.getCandidateCount(0);
        uint256 startBlock = election.gameStartBlock();

        // Upgrade
        Election newImpl = new Election();
        election.upgradeToAndCall(address(newImpl), "");

        // State preserved
        assertEq(election.getCandidateCount(0), candidateCount);
        assertEq(election.gameStartBlock(), startBlock);
        assertEq(election.owner(), address(this));
    }

    function test_Election_Implementation_CannotBeInitialized() public {
        Election impl = new Election();

        vm.expectRevert(Initializable.InvalidInitialization.selector);
        impl.initialize(address(game), address(this));
    }

    function test_Election_Initialize_OnlyOnce() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        election.initialize(address(game), address(this));
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
