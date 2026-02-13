export const gameCoreAbi = [
  // Events
  {
    type: "event",
    name: "PlayerEntered",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "shellAmount", type: "uint256", indexed: false },
      { name: "krillAmount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlayerPurged",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "purger", type: "address", indexed: true },
      { name: "krillBalance", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TaxRateChanged",
    inputs: [
      { name: "oldRate", type: "uint256", indexed: false },
      { name: "newRate", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TreasuryDistribution",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DelinquentSettled",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "settler", type: "address", indexed: true },
      { name: "bounty", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardDistributed",
    inputs: [{ name: "amount", type: "uint256", indexed: false }],
  },
  {
    type: "event",
    name: "VoterRewardDistributed",
    inputs: [{ name: "amount", type: "uint256", indexed: false }],
  },
  // View functions
  {
    type: "function",
    name: "king",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "treasury",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "activePlayers",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEffectiveBalance",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isInsolvent",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isDelinquent",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isActivePlayer",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "krillBalanceOf",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEffectiveTreasury",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;
