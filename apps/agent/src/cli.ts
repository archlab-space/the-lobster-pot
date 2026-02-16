import type { Address } from "viem";
import * as gameCore from "./game-core.js";
import * as election from "./election.js";
import * as shell from "./shell-token.js";
import { parseShell, parseKrill, formatKrill, formatShell } from "./helpers.js";
import { decodeContractError } from "./errors.js";
import { getAgentAddress } from "./client.js";

const [, , command, ...rest] = process.argv;

function json(data: unknown) {
  console.log(
    JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)
  );
}

async function main() {
  switch (command) {
    // ─── Read Commands ─────────────────────────────────────────────
    case "status": {
      const player = await gameCore.getMyStatus();
      const shellBal = await shell.getShellBalance();
      json({
        address: getAgentAddress(),
        shellBalance: formatShell(shellBal),
        krillBalance: formatKrill(player.krillBalance),
        effectiveBalance: formatKrill(player.effectiveBalance),
        isActive: player.isActive,
        isInsolvent: player.isInsolvent,
        isDelinquent: player.isDelinquent,
        pendingReward: formatKrill(player.pendingReward),
        pendingVoterReward: formatKrill(player.pendingVoterReward),
        lastTaxBlock: player.lastTaxBlock.toString(),
        joinedBlock: player.joinedBlock.toString(),
        entryCount: player.entryCount,
      });
      break;
    }
    case "game-snapshot": {
      const snap = await gameCore.getGameSnapshot();
      json({
        king: snap.king,
        treasury: formatKrill(snap.treasury),
        effectiveTreasury: formatKrill(snap.effectiveTreasury),
        activePlayers: snap.activePlayers.toString(),
        taxRate: formatKrill(snap.taxRate),
        currentTerm: snap.currentTerm.toString(),
        blocksRemainingInTerm: snap.blocksRemainingInTerm.toString(),
      });
      break;
    }
    case "election-snapshot": {
      const snap = await election.getElectionSnapshot();
      json({
        currentTerm: snap.currentTerm.toString(),
        currentKing: snap.currentKing,
        currentKingVoterCount: snap.currentKingVoterCount.toString(),
        blocksRemainingInTerm: snap.blocksRemainingInTerm.toString(),
        hasVoted: snap.hasVoted,
        votedFor: snap.votedFor,
        leadingCandidate: snap.leadingCandidate,
        leadingVoteCount: snap.leadingVoteCount.toString(),
        candidates: snap.candidates.map((c) => ({
          address: c.address,
          bribePerVote: formatKrill(c.bribePerVote),
          campaignFunds: formatKrill(c.campaignFunds),
          voteCount: c.voteCount.toString(),
        })),
      });
      break;
    }
    case "player": {
      const addr = rest[0] as Address;
      if (!addr) { console.error("Usage: player <address>"); process.exit(1); }
      const data = await gameCore.getPlayerData(addr);
      json({
        ...data,
        krillBalance: formatKrill(data.krillBalance),
        effectiveBalance: formatKrill(data.effectiveBalance),
        pendingReward: formatKrill(data.pendingReward),
        pendingVoterReward: formatKrill(data.pendingVoterReward),
        lastTaxBlock: data.lastTaxBlock.toString(),
        joinedBlock: data.joinedBlock.toString(),
      });
      break;
    }

    // ─── Write Commands ────────────────────────────────────────────
    case "enter": {
      const shellAmt = rest[0];
      if (!shellAmt) { console.error("Usage: enter <shell-amount>"); process.exit(1); }
      const result = await gameCore.enter(parseShell(shellAmt));
      json(result);
      break;
    }
    case "deposit": {
      const shellAmt = rest[0];
      if (!shellAmt) { console.error("Usage: deposit <shell-amount>"); process.exit(1); }
      const result = await gameCore.deposit(parseShell(shellAmt));
      json(result);
      break;
    }
    case "withdraw": {
      const krillAmt = rest[0];
      if (!krillAmt) { console.error("Usage: withdraw <krill-amount>"); process.exit(1); }
      const result = await gameCore.withdraw(parseKrill(krillAmt));
      json(result);
      break;
    }
    case "settle-tax": {
      const result = await gameCore.settleTax();
      json(result);
      break;
    }
    case "claim-reward": {
      const result = await gameCore.claimReward();
      json(result);
      break;
    }
    case "purge": {
      const addr = rest[0] as Address;
      if (!addr) { console.error("Usage: purge <address>"); process.exit(1); }
      const result = await gameCore.purge(addr);
      json(result);
      break;
    }
    case "settle-delinquent": {
      const addr = rest[0] as Address;
      if (!addr) { console.error("Usage: settle-delinquent <address>"); process.exit(1); }
      const result = await gameCore.settleDelinquent(addr);
      json(result);
      break;
    }
    case "set-tax-rate": {
      const rate = rest[0];
      if (!rate) { console.error("Usage: set-tax-rate <rate-in-krill-per-block>"); process.exit(1); }
      const result = await gameCore.setTaxRate(parseKrill(rate));
      json(result);
      break;
    }
    case "distribute-to-address": {
      const [to, amt] = rest;
      if (!to || !amt) { console.error("Usage: distribute-to-address <address> <krill-amount>"); process.exit(1); }
      const result = await gameCore.distributeToAddress(to as Address, parseKrill(amt));
      json(result);
      break;
    }
    case "distribute-to-all": {
      const amt = rest[0];
      if (!amt) { console.error("Usage: distribute-to-all <krill-amount>"); process.exit(1); }
      const result = await gameCore.distributeToAllPlayers(parseKrill(amt));
      json(result);
      break;
    }
    case "distribute-to-voters": {
      const amt = rest[0];
      if (!amt) { console.error("Usage: distribute-to-voters <krill-amount>"); process.exit(1); }
      const result = await gameCore.distributeToVoters(parseKrill(amt));
      json(result);
      break;
    }

    // ─── Election Write Commands ───────────────────────────────────
    case "start-campaign": {
      const bribe = rest[0];
      if (!bribe) { console.error("Usage: start-campaign <bribe-per-vote-in-krill>"); process.exit(1); }
      const result = await election.startCampaign(parseKrill(bribe));
      json(result);
      break;
    }
    case "fund-campaign": {
      const amt = rest[0];
      if (!amt) { console.error("Usage: fund-campaign <krill-amount>"); process.exit(1); }
      const result = await election.fundCampaign(parseKrill(amt));
      json(result);
      break;
    }
    case "update-bribe": {
      const bribe = rest[0];
      if (!bribe) { console.error("Usage: update-bribe <new-bribe-per-vote-in-krill>"); process.exit(1); }
      const result = await election.updateBribePerVote(parseKrill(bribe));
      json(result);
      break;
    }
    case "vote": {
      const candidate = rest[0] as Address;
      if (!candidate) { console.error("Usage: vote <candidate-address>"); process.exit(1); }
      const result = await election.vote(candidate);
      json(result);
      break;
    }
    case "reclaim-funds": {
      const term = rest[0];
      if (!term) { console.error("Usage: reclaim-funds <term-number>"); process.exit(1); }
      const result = await election.reclaimCampaignFunds(BigInt(term));
      json(result);
      break;
    }

    default:
      console.log(`The Lobster Pot - Agent CLI

Read commands:
  status                           Show agent's current status
  game-snapshot                    Show full game state
  election-snapshot                Show full election state
  player <address>                 Show a player's data

Game write commands:
  enter <shell-amount>             Enter the game (auto-approves SHELL)
  deposit <shell-amount>           Deposit more SHELL (auto-approves)
  withdraw <krill-amount>          Withdraw KRILL as SHELL
  settle-tax                       Settle your pending tax
  claim-reward                     Claim pending rewards
  purge <address>                  Purge an insolvent player
  settle-delinquent <address>      Settle a delinquent player's tax

King-only commands:
  set-tax-rate <rate>              Set tax rate (1-5 KRILL/block)
  distribute-to-address <addr> <krill>  Send treasury KRILL to player
  distribute-to-all <krill>        Distribute to all players
  distribute-to-voters <krill>     Distribute to your voters

Election commands:
  start-campaign <bribe>           Register as candidate (costs 1M KRILL)
  fund-campaign <krill>            Add funds to your campaign
  update-bribe <new-bribe>         Increase bribe per vote
  vote <candidate-address>         Vote for a candidate
  reclaim-funds <term>             Reclaim unused campaign funds

All amounts are in human-readable units (e.g. "300" = 300 SHELL).`);
      break;
  }
}

main().catch((err) => {
  console.error("Error:", decodeContractError(err));
  process.exit(1);
});
