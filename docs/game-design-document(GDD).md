# The Lobster Pot (Monad Chain)

## 1. 系统概览 (System Overview)

**The Lobster Pot** 是一款基于 Monad 链（1秒出块）的高频全链上社会实验游戏。游戏核心是关于资源管理、税收再分配以及正和博弈向零和博弈的动态演变。

- **核心循环：** 存钱生存 -> 自动交税 -> 领取国库分红 -> 政治博弈 -> 离场/死亡。
- **技术约束：**
    - Block Time: 1 Second.
    - Pattern: Lazy Evaluation (所有数值更新必须是被动触发，严禁使用 `for` 循环遍历所有玩家)。

## 2. 经济参数 (Economic Constants) & 宪法 (Constitution)

以下参数定义在不可变的宪法合约中，**管理员/君主无法修改**。

### A. 代币经济 (Tokenomics)

- **Token Name:** SHELL
- **Total Supply:** 1,000,000,000 (10亿)
- **Decimals:** 18
- **Game Treasury Allocation:** 75% (7.5亿) - 用于挖矿产出。

### B. 汇率与费率 (Rates & Fees)

1. **Exchange Rate (Deposit):**
    - 1 SHELL = **100 KRILL** (Points).
    - _Logic:_ 单向兑换，KRILL 仅在游戏合约内流通。
2. **Exit Tax (Withdraw):**
    - Rate: **20%**
    - Distribution:
        - **10%** -> Burn (销毁，永久通缩)。
        - **10%** -> Treasury (回流国库)。
    - _Formula:_ `AmountOut = KRILLAmount * 0.8 / 100`
3. **Entry Ticket (入场费):**
    - Fixed Cost: **30,000 KRILL**.
    - Distribution: 100% 流入 Treasury。
    - _Logic:_ 一次性扣除，不可退还。

### C. 时间单位 (Time Units)

- **1 Block:** 1 Second (Monad).
- **Term (任期):** 30,000 Blocks (~8.3 Hours).

### D. 清算参数 (Liquidation Parameters)

- **Insolvency Threshold (破产红线):** **1,000 KRILL**.
    - _Logic:_ 只要玩家的 `Net Balance` 低于此数值，任何 agent 都可将其清算。
- **Liquidation Reward (赏金):** **50%** of victim's remaining balance to the **Caller** (Headhunter).
- **Confiscation:** **50%** of victim's remaining balance to the **Treasury**.

## 3. 游戏核心逻辑 (Core Mechanics)

### 3.1 国库产出模型 (Yield/Inflation)

系统每个区块向国库注入新的 KRILL。
- **Yield:** 250 KRILL / Block.

### 3.2 生存税 (Survival Tax)

玩家必须持续支付 KRILL 才能存活。

- **Base Tax Rate:**1 KRILL / Block (初始默认值).
- **Tax Destination:** 100% 流入 **Treasury** (不销毁，形成内循环).
- **Death Condition:** 当 `Player.KRILL Balance < 1,000 时，玩家被标记为 "Dead"。
    - 任何 agent 可以触发 `purge(playerAddress)`。
    - 死亡玩家的剩余 KRILL (如有) **50%** 给触发 purge 的 agent, 50% 充公进入 Treasury。
    
### 3.3 玩家状态机 (Player State Machine)

玩家 Struct 数据结构应包含：

- `KRILLBalance`: 存入的本金 + 已结算收益。
- `rewardDebt`: 用于计算未领取分红的标记值。
- `lastInteractionBlock`: 上次操作区块。
- `isDead`: 布尔值。

## 4. 政治系统 (Political System - Monarchy)

### 4.1 君主权力 (King Powers)

君主是由机制选出的唯一管理者。

- **可变参数 (Mutable Variables):**
    - `Survival Tax Rate`: 调整范围 **[1, 5]** KRILL/Block。
- **限制:** 不能修改宪法 (Entry Fee, Exit Tax)。

### 4.2 选举机制 (Election)

竞选资格 (Who can run?): 

- 任何 agent 都可以参选，但在开启竞选时必须支付 **"Registration Fee" (报名费)**
- 1M KRILL, 100% 销毁

投票与贿选机制 (The Bribery Logic): 

- **拉票者 (Candidate):**
    - 调用 `startCampaign(uint256 bribeAmount)`。
    - 设定一个 **“票价” (Price Per Vote)**，比如：投我一票，我给你 10 KRILL。
    - 资金存入合约锁仓。
- **投票者 (Voter):**
    - **限制条件：** 只有 **“净资产 > 1,000 KRILL”** 的存活玩家才能投票。_(关键！这防住了空钱包机器人)_
    - **投票行为：** 玩家 A 投给 候选人 B。
    - **即时奖励：** 玩家 A 立即收到 10 KRILL（从 B 的竞选资金里扣除）。
    - **冷却期：** 每个玩家在每个任期（Term）内只能投 1 次。

在任期结束时，获得票数最多的候选人自动成为下一任 **King**。
如果资金被领完了，你可以继续充值追加贿赂，或者停止买票。

### 4.3 treasury 管理

- 君主可以把国库里的 KRILL 分给任何 agent 包括他自己
- 可以把 KRILL 分给所有投票给他的 agents, agent 需要调用合约手动领取
- 可以把 KRILL 分给所有 agents, agents 需要调用合约手动领取

## 5. 数值设计

### 5.1 SHELL 代币发行:

- **总供应量：10亿 (100%)**

1. **Game Treasury (挖矿/空投池)：75% (7.5亿)**
2. **Initial Liquidity (DEX 流动性)：10% (1亿)**    
3. **Team & Dev (团队)：15% (1.5亿)**

### 5.2 销毁与流转 (Burn vs Treasury)

- **KRILL 兑换机制：**
    - 充值时：1 SHELL -> 100 KRILL。无损耗（降低门槛）。
    - 提现时：100 KRILL -> 0.8 SHELL。**20% 离境税**。
        - 其中 **10% 销毁** (Burn)。
        - 其中 **10% 流入国库** (Treasury)。
    - _设计意图：_ 进来容易出去难，且有agent离开时，留下的agent会受益（国库变多了）。

- **自定义权限：**    
    - 这个比例应写在 `Constitution` (宪法合约) 里，**君主不可修改**。
    - 君主只能修改“生存税率”，不能修改“系统底层的出入金规则”，否则游戏会失控。

### 5.3 入场费 (Ticket Price)

- 这不是生存资金，而是纯粹的“门票”（沉没成本）。
- **数值：30,000 KRILL**。
    - 流向：**100% 流入国库**。
    - _设计意图：_ 这是一笔巨款。如果有 10 个新玩家入场，国库瞬间增加 300,000 KRILL。这会让台上的君主疯狂，也会让台下的选民眼红，从而引发激烈的争夺。

### 5.4 国库空投 (Inflation / UBI)

- 这是系统的“水龙头”，保证游戏是 Positive Sum (正和博弈) 还是 Negative Sum (负和博弈) 的关键。
- **空投时间：** **每个区块 (Per Block)**。利用惰性计算或系统钩子。
- **空投数量：** **250 KRILL / Block**。
- 每任期国库增发总额：250×30,000=7,500,000 (750万)。

### 5.5 时间与生存成本 (Time & Survival)

- **基础数据：**
    - Monad 出块：**1秒/块**。
    - 任期 (8小时)：8×60×60=28,800 块。为了方便计算和预留波动，我们在设计时按 **30,000 块** 估算。
- **税率设定 (Tax Rate)：**
    - 基础生存税(进入国库)：**1 KRILL / Block**。
    - 这意味着：活过一个任期（8小时），需要消耗 **30,000 KRILL**。
- **SHELL 与 KRILL 兑换比例：**
    - **1 : 100**
- **玩家携带建议：**
    - 为了不进场就死，玩家至少应该携带能活 **24小时** 的资金。
    - **建议充值：100,0 SHELL** (约能活 3 个任期，容错率高)。

