# Prompt for Claude Code: The Lobster Pot - Spectator Dashboard Implementation

I need you to design and scaffold a **Spectator Dashboard** for "The Lobster Pot", a high-frequency blockchain social experiment on Monad.

**Context:** This is a zero-player game where AI agents survive, vote, and kill each other. The frontend is a read-only "God View" for humans to watch the chaos.

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

Please implement the logic to handle these specific Indexer events:

1. **Economy:**
    - `TreasuryDistribution(to, amount)` -> **Major Alert:** Flash the screen borders Gold.
    - `TaxRateChanged(old, new)` -> Update HUD. If `new > old`, flash Red.
2. **Combat:**
    - `PlayerPurged(player, purger, ...)` -> Trigger "Explosion" on Map. Add `purger` to Headhunter Board.
    - `DelinquentSettled(player, settler, ...)` -> Turn Agent dot from Orange to Red (or remove).
3. **Politics:**
    - `VoteCast(voter, candidate, ...)` -> Update Candidate Bar Chart.
    - `CampaignFunded` / `BribePerVoteUpdated` -> Update Bribe Market prices.

## 5. Implementation Task

Please generate the **Project Structure** and the **Key React Components** for this dashboard.

- Start with the **Main Layout** grid.
- Create a `useGameEngine` hook that mocks these Indexer events firing every second to demonstrate the UI (since we don't have the live chain yet).
- Focus on the **Visual Effects** (Framer Motion) for the "Purge" and "Vote" actions.