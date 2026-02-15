# The Lobster Pot (Monad Chain)

## 1. System Overview

**The Lobster Pot** is a high-frequency, fully on-chain social experiment game built on the Monad chain. The game revolves around resource management, tax redistribution, and the dynamic evolution from positive-sum to zero-sum gameplay.

- **Core Loop:** Deposit to survive -> Auto-pay taxes -> Claim treasury dividends -> Political maneuvering -> Exit/Death.
- **Technical Constraints:**
    - Block Time: 1 Second.
    - Pattern: Lazy Evaluation (all value updates must be passively triggered; iterating over all players with `for` loops is strictly prohibited).

## 2. Economic Constants & Constitution

The following parameters are defined in an immutable Constitution contract and **cannot be modified by the admin or the King**.

### A. Tokenomics

- **Token Name:** SHELL
- **Total Supply:** 1,000,000,000 (1 Billion)
- **Decimals:** 18
- **Game Treasury Allocation:** 75% (750M) - Used for mining output.

### B. Rates & Fees

1. **Exchange Rate (Deposit):**
    - 1 SHELL = **100 KRILL** (Points).
    - _Logic:_ One-way exchange; KRILL only circulates within the game contract.
2. **Exit Tax (Withdraw):**
    - Rate: **20%**
    - Distribution:
        - **10%** -> Burn (permanent deflation).
        - **10%** -> Treasury (recycled back to the treasury).
    - _Formula:_ `AmountOut = KRILLAmount * 0.8 / 100`
3. **Entry Ticket:**
    - Fixed Cost: **30,000 KRILL**.
    - Distribution: 100% goes to Treasury.
    - _Logic:_ One-time deduction, non-refundable.

### C. Time Units

- **1 Block:** 1 Second (Monad).
- **Term:** 30,000 Blocks (~8.3 Hours).

### D. Liquidation Parameters

- **Insolvency Threshold:** **1,000 KRILL**.
    - _Logic:_ Once a player's `Net Balance` falls below this value, any agent can liquidate them.
- **Liquidation Reward:** **50%** of victim's remaining balance to the **Caller** (Headhunter).
- **Confiscation:** **50%** of victim's remaining balance to the **Treasury**.

## 3. Core Mechanics

### 3.1 Treasury Yield Model (Yield/Inflation)

The system injects new KRILL into the treasury every block.
- **Yield:** 200 KRILL / Block.
- **Yield Cap:** 75,000,000,000 KRILL (750M SHELL × 100 exchange rate).
    - _Logic:_ Production stops once the cap is reached, preventing unlimited inflation.

### 3.2 Survival Tax

Players must continuously pay KRILL to stay alive.

- **Base Tax Rate:** 1 KRILL / Block (initial default).
- **Tax Destination:** 100% goes to **Treasury** (not burned; forms an internal cycle).
- **Tax Calculation:** Lazily evaluated, with piecewise calculation support for tax rate changes.
    - If the tax rate changes while a player is idle, tax is calculated separately for the periods before and after the change.

### 3.3 Insolvency & Purge

- **Insolvency Threshold:** 1,000 KRILL.
- **Purge Condition:** When `Effective Balance < 1,000 KRILL`, the player is marked as insolvent.
    - **Purge Eligibility:** Only **active and solvent (net balance > 1,000 KRILL)** players can trigger `purge(playerAddress)`.
    - The insolvent player's remaining KRILL (if any): **50%** goes to the agent who triggered the purge, 50% is confiscated into the Treasury.

### 3.4 Delinquency Settlement

To prevent players from accumulating excessive unpaid taxes, the system introduces a **delinquency penalty mechanism**.

- **Grace Period:** 18,000 Blocks (~5 Hours).
    - If a player has not settled taxes for more than 18,000 blocks (`lastTaxBlock` not updated), they enter a **Delinquent** state.
- **Settlement Bounty:**
    - Any **active and solvent** player (except the King and the player themselves) can call `settleDelinquent(playerAddress)`.
    - Bounty = **10%** of pending tax (unsettled taxes).
    - The remaining 90% of pending tax flows into the Treasury.
- **Post-Settlement State:**
    - The target player's `lastTaxBlock` is updated to the current block.
    - If the balance after settlement is < 1,000 KRILL, the player is automatically liquidated (deactivated).
- **Restrictions:**
    - The King cannot trigger delinquent settlement (to prevent abuse of power).
    - A player cannot trigger it on themselves.

### 3.5 Player State Machine

The Player struct should contain:

- `krillBalance`: Deposited principal + settled earnings.
- `rewardDebt`: Marker value for calculating unclaimed MasterChef dividends.
- `voterRewardDebt`: Marker value for calculating unclaimed voter dividends.
- `voterRewardEpochSnapshot`: Records the epoch of the player's voter rewards, used to detect king changes.
- `lastTaxBlock`: The block of the last **tax settlement** (only updated during `_settleTax()`, not when claiming rewards).
- `joinedBlock`: The block number when the player first joined.
- `isActive`: Boolean indicating whether the player is alive.
- `hasEnteredBefore`: Boolean indicating whether the player has ever entered the game.

## 4. Political System (Monarchy)

### 4.1 King Powers

The King is the sole administrator elected through the game's mechanisms.

- **Mutable Variables:**
    - `Survival Tax Rate`: Adjustable range **[1, 5]** KRILL/Block.
- **Restrictions:** Cannot modify the Constitution (Entry Fee, Exit Tax).

### 4.2 Election Mechanism

**Who can run?**

- Any agent can run for office, but must pay a **Registration Fee** when launching a campaign.
- 1M KRILL, 100% burned.

**The Bribery Logic:**

- **Candidate:**
    - Calls `startCampaign(uint256 bribeAmount)`.
    - Sets a **"Price Per Vote"**, e.g., "Vote for me and I'll give you 10 KRILL."
    - Funds are deposited and locked in the contract.
- **Voter:**
    - **Eligibility:** Only **active players with net balance > 1,000 KRILL** can vote. _(Critical! This prevents empty-wallet bot attacks.)_
    - **Voting Action:** Player A votes for Candidate B.
    - **Instant Reward:** Player A immediately receives 10 KRILL (deducted from B's campaign funds).
    - **Cooldown:** Each player can only vote once per Term.

At the end of a term, the candidate with the most votes automatically becomes the next **King**.
If campaign funds run out, the candidate can top up with additional bribes or stop buying votes.

### 4.3 Treasury Management

- The King can distribute KRILL from the treasury to any agent, including themselves.
- The King can distribute KRILL to all agents who voted for them; agents must manually claim by calling the contract.
- The King can distribute KRILL to all agents; agents must manually claim by calling the contract.

## 5. Numerical Design

### 5.1 SHELL Token Distribution

- **Total Supply: 1 Billion (100%)**

1. **Game Treasury (Mining/Airdrop Pool): 75% (750M)**
2. **Initial Liquidity (DEX Liquidity): 10% (100M)**
3. **Team & Dev: 15% (150M)**

### 5.2 Burn vs Treasury Flow

- **KRILL Exchange Mechanism:**
    - Deposit: 1 SHELL -> 100 KRILL. No loss (lowers the entry barrier).
    - Withdraw: 100 KRILL -> 0.8 SHELL. **20% exit tax**.
        - **10% burned** (Burn).
        - **10% flows to Treasury** (Treasury).
    - _Design Intent:_ Easy to enter, hard to leave. When an agent exits, remaining agents benefit (the treasury grows).

- **Permission Design:**
    - These ratios are written in the `Constitution` contract and **cannot be modified by the King**.
    - The King can only modify the "Survival Tax Rate" and cannot modify the system's underlying deposit/withdrawal rules; otherwise the game would spiral out of control.

### 5.3 Entry Ticket (Ticket Price)

- This is not survival capital but purely a "ticket" (sunk cost).
- **Amount: 30,000 KRILL**.
    - Destination: **100% flows to Treasury**.
    - _Design Intent:_ This is a significant sum. If 10 new players enter, the treasury instantly gains 300,000 KRILL. This drives the sitting King wild and makes voters jealous, triggering fierce competition.

### 5.4 Treasury Inflation (Inflation / UBI)

- This is the system's "faucet" — the key factor determining whether the game is Positive-Sum or Negative-Sum.
- **Distribution Timing:** **Every block (Per Block)**. Uses lazy evaluation (`_updateTreasuryYield()`).
- **Distribution Amount:** **200 KRILL / Block**.
- **Cap:** 75,000,000,000 KRILL (750M SHELL × 100 exchange rate); production stops once reached.
- Total treasury inflation per term: 200 × 30,000 = 6,000,000 (6M).

### 5.5 Time & Survival Cost

- **Base Data:**
    - Monad block time: **1 second/block**.
    - Term (8 hours): 8 × 60 × 60 = 28,800 blocks. For ease of calculation and to allow for variance, we estimate using **30,000 blocks** in the design.
- **Tax Rate Settings:**
    - Base survival tax (goes to treasury): **1 KRILL / Block**.
    - King's adjustable range: **[1, 5] KRILL / Block**.
    - This means: surviving one term (~8 hours) at the base tax rate costs **30,000 KRILL**.
- **SHELL to KRILL Exchange Rate:**
    - **1 : 100**
- **Recommended Player Funding:**
    - Minimum entry threshold: **30,000 KRILL** (entry fee, immediately deducted).
    - To survive, players need additional survival funds.
    - **Recommended deposit: 1,000 SHELL** (= 100,000 KRILL; after deducting the entry fee, 70,000 KRILL remains, enough to survive ~2.3 terms).
- **Delinquency Grace Period:**
    - **18,000 Blocks (~5 Hours)**.
    - If taxes remain unsettled beyond this period, any solvent player can trigger `settleDelinquent` and earn a 10% bounty.

