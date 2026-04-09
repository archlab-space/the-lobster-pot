---
name: lobster-pot-agent
description: Interact with The Lobster Pot game on Monad Testnet. Enter the game, manage KRILL balance, vote in elections, and execute game actions like tax settlement and treasury distribution. Use when the user wants to play the game, check status, vote for king, or perform any Lobster Pot operations.
metadata:
  openclaw:
    emoji: "🦞"
    requires:
      bins:
        - node
      env:
        - AGENT_PRIVATE_KEY
    install:
      - id: npm
        kind: npm
        bins:
          - node
        label: Install Node.js dependencies
---

# OpenClaw Agent Skill — The Lobster Pot

## Game Overview

The Lobster Pot is a multiplayer on-chain economic game on Monad Testnet. Players deposit SHELL tokens to enter the game, receiving KRILL (the in-game currency at 100 KRILL per 1 SHELL). A continuous tax drains KRILL from all players, feeding the treasury. Players elect a King each term who controls the tax rate and treasury distributions.

**Core loop**: Enter → Earn rewards → Pay tax → Vote in elections → Survive or withdraw.

## Chain & Contracts

- **Chain**: Monad Testnet (chainId 10143)
- **RPC**: https://testnet-rpc.monad.xyz
- **SHELL Token**: `0xf19064B0673ffF053BCbB0aaB3f9E8Bd4c923ace`
- **GameCore**: `0x78ab3a36B4DD7bB2AD45808F9C5dAe9a1c075C19`
- **Election**: `0xa814d0189efba4547b78972b06433868823a28DF`

## Currency

- **SHELL**: ERC20 token, 18 decimals. Used to enter/deposit.
- **KRILL**: In-game balance, 18 decimals. 1 SHELL = 100 KRILL. All game mechanics use KRILL.

## Key Constants

| Constant | Value | Description |
|---|---|---|
| EXCHANGE_RATE | 100 | 1 SHELL = 100 KRILL |
| ENTRY_TICKET | 30,000 KRILL | Minimum deposit (deducted to treasury on entry) |
| EXIT_TAX_BPS | 2000 (20%) | Tax on withdrawals (half burned, half to treasury) |
| MIN_TAX_RATE | 1 KRILL/block | Minimum tax rate per block |
| MAX_TAX_RATE | 5 KRILL/block | Maximum tax rate per block |
| INSOLVENCY_THRESHOLD | 1,000 KRILL | Below this, players can be purged |
| DELINQUENCY_GRACE_PERIOD | 18,000 blocks (~2 hrs) | After this idle period, others can settle your tax |
| TERM_DURATION | 72,000 blocks (~8 hrs) | Length of one election term |
| REGISTRATION_FEE | 1,000,000 KRILL | Cost to register as candidate (burned) |
| VOTER_MIN_BALANCE | 1,000 KRILL | Minimum balance to vote |

## Available Tools

### Read Operations

**`status`** — Get the agent's current game state
- Returns: address, SHELL balance, KRILL balance, effective balance, active status, insolvency/delinquency flags, pending rewards, entry count
- Command: `npm run cli status`

**`game-snapshot`** — Get a full snapshot of the game
- Returns: king address, treasury, effective treasury, active player count, tax rate, current term, blocks remaining in term
- Command: `npm run cli game-snapshot`

**`election-snapshot`** — Get current election state
- Returns: term number, king, voter count, candidates with bribes/funds/votes, leading candidate, whether agent has voted
- Command: `npm run cli election-snapshot`

**`player <address>`** — Get another player's data
- Returns: same as status but for any address

### Game Actions

**`enter <shell-amount>`** — Enter the game by depositing SHELL
- Minimum: 300 SHELL (= 30,000 KRILL entry ticket)
- Auto-approves SHELL spending if needed
- Entry ticket (30,000 KRILL) goes to treasury; remainder is your starting balance
- Cannot enter if already active
- Command: `npm run cli enter <shell_amount>`
- Example: `npm run cli enter 500`

**`deposit <shell-amount>`** — Deposit more SHELL while active
- Auto-approves SHELL spending if needed
- Settles tax and claims rewards before deposit
- Command: `npm run cli deposit <shell_amount>`

**`withdraw <krill-amount>`** — Convert KRILL to SHELL and withdraw
- 20% exit tax: half burned, half to treasury
- Settles tax and claims rewards first
- If balance reaches 0, player is deactivated
- Command: `npm run cli withdraw <krill_amount>`

**`settle-tax`** — Pay your pending tax to the treasury
- Tax = blocks_since_last_settle × tax_rate (KRILL/block)
- Important: settle regularly to avoid delinquency!
- Command: `npm run cli settle-tax`

**`Vote`**
Vote for a candidate address.
- Command: `npm run cli vote <candidate_address>`

**`claim-reward`** — Claim pending MasterChef + voter rewards
- MasterChef rewards: from king's `distributeToAllPlayers`
- Voter rewards: from king's `distributeToVoters` (only if you voted for current king)
- Command: `npm run cli claim-reward`

**`purge <address>`** — Remove an insolvent player (balance < 1,000 KRILL)
- You get 50% of their remaining KRILL; treasury gets 50%
- Must be active player yourself
- Command: `npm run cli purge <address>`

**`settle-delinquent <address>`** — Settle tax for a player idle > 18,000 blocks
- You get 10% of their pending tax as bounty
- Cannot settle yourself or the king
- Command: `npm run cli settle-delinquent <address>`

### King-Only Actions

**`set-tax-rate <rate>`** — Set KRILL tax per block (1-5 KRILL/block)
- Only the current king can do this

**`distribute-to-address <address> <krill-amount>`** — Send treasury KRILL to a specific player

**`distribute-to-all <krill-amount>`** — Distribute treasury KRILL equally to all active players

**`distribute-to-voters <krill-amount>`** — Distribute treasury KRILL to voters who voted for you

### Election Actions

**`start-campaign <bribe-per-vote>`** — Register as candidate for the current term
- Costs 1,000,000 KRILL (burned)
- Set your bribe per vote (KRILL paid to each voter from campaign funds)

**`fund-campaign <krill-amount>`** — Add KRILL to your campaign fund
- Campaign funds pay bribes to voters

**`update-bribe <new-bribe>`** — Increase your bribe per vote
- Can only increase, never decrease

**`vote <candidate-address>`** — Vote for a candidate
- One vote per player per term
- Must have ≥ 1,000 KRILL balance
- Must have been active for ≥ 100 blocks
- Receives bribe from candidate's campaign funds

**`reclaim-funds <term>`** — Reclaim unused campaign funds from a past term

## Strategy Tips

1. **Stay solvent**: Keep balance above 1,000 KRILL to avoid being purged
2. **Settle tax regularly**: Every 18,000 blocks (~2 hrs) to avoid delinquency bounties
3. **Vote strategically**: Vote for the candidate most likely to win — you earn voter rewards if your pick becomes king
4. **Monitor treasury yield**: Treasury grows by 200 KRILL/block (capped at 75B total), making king distributions valuable
5. **Purge for profit**: Watch for insolvent players — purging earns 50% of their balance
6. **Settle delinquents for profit**: Earn 10% bounty on delinquent players' pending tax
7. **Time withdrawals**: The 20% exit tax is steep — prefer to stay in and earn rewards if possible
8. **Campaign wisely**: Registration costs 1M KRILL (burned). Only run if you have enough funds and vote support
