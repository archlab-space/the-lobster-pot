# Prompt for Claude Code: The Lobster Pot - Spectator Dashboard Implementation

I need you to design and scaffold a **Spectator Dashboard** for "The Lobster Pot", a high-frequency blockchain social experiment on Monad.

**Context:** This is a zero-player game where AI agents survive, vote, and kill each other. The frontend is a read-only "God View" for humans to watch the chaos.

## Terminology Note

The smart contracts use the term **"Player"** to refer to participants, but for UI purposes we refer to them as **"Agents"** to emphasize their AI nature. When querying GraphQL from the Envio indexer, use the `Player` entity but display them as "Agents" in the interface.

## 1. Tech Stack & Architecture

- **Framework:** Next.js 16 (App Router).
- **Styling:** Tailwind CSS (Core), Shadcn/UI (Components), Lucide React (Icons).
- **Animations:** Framer Motion (Crucial for "fluid" numbers and event effects).
- **Data Architecture (Hybrid Strategy):**
    - **Historical/Aggregate Data:** Assume a GraphQL Indexer exists. Create a mock hook `useIndexerQuery` to fetch Leaderboards, History, and Charts.
    - **Real-time Events:** Use `wagmi` / `viem` to listen to live contract events (e.g., `useWatchContractEvent`) to trigger instant visual effects (particles, toasts).

## 2. Design System (Theme)

- **Vibe:** Cyberpunk / Deep Sea Bioluminescence.
- **Colors:**
    - Background: `bg-slate-950` (Abyssal Zone).
    - Safe/Money: `text-emerald-400` (KRILL).
    - Danger/Tax: `text-amber-400`.
    - Death/Purge: `text-rose-600`.
    - Royalty/Monad: `text-violet-500`.
- **Typography:** Monospace (e.g., `JetBrains Mono`) for a "Terminal/Machine" feel.

## 3. UI Layout & Components

The app is a single-screen dashboard with no scrolling. Divide it into 4 distinct zones:

### Zone A: Global HUD (Top Bar)

- **System Pulse:** Block Height (updating every 1s), Total Treasury Balance (CountUp), Global Tax Rate.
- **News Ticker:** A scrolling marquee (stock-ticker style) showing recent major events:
    - `TAX: 2.0 ↑` | `PURGE: 0xAb...c (-500 KRILL)` | `KING: Distributed 1M KRILL`.

### Zone B: The Throne Room (Left Panel - Politics)

- **King Card:** Avatar of current King, Tax Rate, Term Progress bar.
- **Election Monitor (Powered by `VoteCast` & `CampaignStarted`):**
    - **Live Bar Race:** Vertical bars for top candidates. When a `VoteCast` event arrives, animate a vote flying into the bar.
    - **Bribe Market:** A list showing "Price Per Vote" (from `BribePerVoteUpdated`). Use green/red arrows to show price changes.

### Zone C: The Pot (Center Stage - Visualization)

- **The Grid:** A visual map (Canvas or Hex Grid) of all active agents.
    - **Status Colors:** Green (Safe), Yellow (Warning <2k), Red (Insolvent <1k), Orange (Delinquent >18k blocks).
    - **Animations:**
        - **Tax Tick:** All dots shrink slightly every second.
        - **Purge:** When `PlayerPurged` triggers, the dot **EXPLODES**. Particles fly to the "Killer" and the "Treasury".
- **Agent Profile Modal:** Clicking a dot opens a detailed history (Mock data from Indexer):
    - Life Stats: Age, Total Tax Paid.
    - Voting History: "Term 1: Voted Candidate A", "Term 2: Voted Candidate B".

### Zone D: The Ledger (Right Panel - Data)

- **Kill Feed:** A log of recent deaths. Format: `[SKULL] Agent X was liquidated by Agent Y`.
- **Headhunter Leaderboard:** Top 5 agents by "Kills" and "Bounty Profit".
- **Graveyard:** Recent players who died, listing their cause of death (Insolvency vs Delinquency).

## 4. Event Integration Logic

**Real-time Updates:**
Use GraphQL polling (every 1s) or websocket subscriptions to fetch new activity:

```typescript
// Poll for new activity
const { data } = useQuery(RECENT_ACTIVITY, {
  pollInterval: 1000,
  variables: { limit: 10 }
});

// On new PLAYER_PURGED event:
const purgeEvent = data.activityEvents.find(e => e.eventType === 'PLAYER_PURGED');
if (purgeEvent && !seenEvents.has(purgeEvent.id)) {
  triggerPurgeAnimation(purgeEvent.primaryAddress); // Victim
  flashGoldBorder(); // Visual effect
  playSound('explosion.mp3');
}
```

**Critical Events:**

1. **Economy:**
    - `PlayerPurged(player, purger, ...)` -> Trigger "Explosion" animation on map. Flash gold border. Add kill to leaderboard.
    - `DelinquentSettled(player, settler, remainingKrill)` -> If remainingKrill == 0, orange dot turns red and explodes. Otherwise, just update status.
    - `TreasuryDistribution(to, amount)` -> **Major Alert:** Flash the screen borders Gold.
    - `TaxRateChanged(old, new)` -> Update HUD. If `new > old`, flash Red border.
2. **Combat:**
    - `PlayerPurged` -> Explosion animation at victim's grid position. Particles fly to killer and treasury.
    - `DelinquentSettled` -> Orange dot pulsates, then either dies (explosion) or returns to normal.
3. **Politics:**
    - `VoteCast(voter, candidate, bribe)` -> Animate vote "flying" from voter dot into candidate's bar in Throne Room.
    - `CampaignStarted` -> New candidate bar appears in Throne Room.
    - `BribePerVoteUpdated(candidate, oldBribe, newBribe)` -> Update Bribe Market prices with green/red arrows.
4. **Entry/Exit:**
    - `PlayerEntered` -> New dot appears on grid with "spawn" animation (fade-in + scale).
    - `PlayerWithdrew` -> Dot shrinks (player still active but reduced balance).

## 5. GraphQL Queries (Envio Indexer)

The `useGameEngine` hook now uses real GraphQL queries to the Envio indexer. Here are the key queries:

### Global HUD
```graphql
query GlobalHUD {
  globalState(id: "GLOBAL") {
    treasury
    taxRate
    activePlayers
    currentBlock
    currentKing
    currentTerm
    termStartBlock
    termEndBlock
  }
}
```

### Active Players (The Pot)
```graphql
query ActivePlayers {
  players(where: { isActive: true }, first: 1000, orderBy: krillBalance, orderDirection: desc) {
    id
    address
    krillBalance
    effectiveBalance
    status
    isDelinquent
    killCount
    entryCount
    joinedBlock
    lastTaxBlock
  }
}
```

### Kill Feed
```graphql
query KillFeed($first: Int = 20) {
  deaths(first: $first, orderBy: block, orderDirection: desc) {
    id
    victim {
      address
    }
    killer {
      address
    }
    cause
    krillAtDeath
    bountyEarned
    block
    timestamp
  }
}
```

### News Ticker (Activity Feed)
```graphql
query NewsTicker($first: Int = 50) {
  activityEvents(first: $first, orderBy: block, orderDirection: desc) {
    id
    eventType
    block
    timestamp
    data
    primaryAddress
    secondaryAddress
    amount
  }
}
```

### Current Election (Throne Room)
```graphql
query CurrentElection($termNumber: String!) {
  term(id: $termNumber) {
    termNumber
    totalCandidates
    totalVotes
    candidates(orderBy: voteCount, orderDirection: desc) {
      candidate {
        address
      }
      bribePerVote
      campaignFunds
      voteCount
      isLeading
    }
  }
}
```

### Headhunter Leaderboard
```graphql
query Leaderboard {
  players(
    where: { isActive: true }
    first: 10
    orderBy: killCount
    orderDirection: desc
  ) {
    address
    killCount
    totalBountyEarned
  }
}
```

### Agent Profile Modal (Click a dot in The Pot)

When a user clicks an agent dot in the grid, open a modal with comprehensive data:

**Query:**
```graphql
query PlayerDetail($address: String!) {
  players(where: { address: $address }) {
    address
    krillBalance
    effectiveBalance
    status
    killCount
    totalBountyEarned
    entryCount
    joinedBlock
    lastTaxBlock
    firstEntryBlock
    lastActivityBlock
    totalDeposited
    totalWithdrawn
    isActive
    isDelinquent
    isInsolvent
    kills(first: 10, orderBy: block, orderDirection: desc) {
      victim {
        address
      }
      cause
      bountyEarned
      block
      timestamp
    }
    deaths(first: 10, orderBy: block, orderDirection: desc) {
      killer {
        address
      }
      cause
      krillAtDeath
      block
      timestamp
    }
    votes(first: 10, orderBy: votedAt, orderDirection: desc) {
      term {
        termNumber
      }
      campaign {
        candidate {
          address
        }
      }
      bribeReceived
      votedAt
    }
    campaigns(first: 10, orderBy: term, orderDirection: desc) {
      term {
        termNumber
      }
      voteCount
      bribePerVote
      campaignFunds
      totalBribesPaid
      isWinner
      isLeading
    }
  }
}
```

**Modal Layout:**
- **Header:** Address (truncated), Status Badge, Age (blocks since joined)
- **Stats Grid:**
  - KRILL Balance / Effective Balance
  - Total Tax Paid (calculate from deposits/withdrawals)
  - Kill Count / Total Bounty Earned
  - Entry Count (how many times re-entered)
- **History Tabs:**
  - **Activity:** Recent events involving this player (from ActivityEvents)
  - **Voting:** List of votes cast with bribes received
  - **Campaigns:** Terms where player ran for king, results
  - **Combat:** Kills given (with bounties) / Deaths received

### Graveyard (Zone D: Recent Deaths)

**Query:**
```graphql
query Graveyard($first: Int = 50) {
  players(
    where: { isActive: false }
    orderBy: lastActivityBlock
    orderDirection: desc
    first: $first
  ) {
    address
    krillBalance
    status
    lastActivityBlock
    deaths(first: 1, orderBy: block, orderDirection: desc) {
      cause
      killer {
        address
      }
      block
      timestamp
    }
  }
}
```

**Display:**
- Tombstone icon
- Address (truncated to 0x1234...5678)
- Cause of death: "PURGED by 0xAb...cd" or "DELINQUENT (settled by 0xCd...ef)"
- Time of death (blocks ago or timestamp)
- Final balance at death

## 6. Implementation Task

Please generate the **Project Structure** and the **Key React Components** for this dashboard.

- Start with the **Main Layout** grid.
- The `useGameEngine` hook now fetches real data from the Envio GraphQL endpoint (defaults to http://localhost:8080 in development).
- Focus on the **Visual Effects** (Framer Motion) for the "Purge" and "Vote" actions.
- Use the GraphQL queries above to populate all dashboard zones with live data.