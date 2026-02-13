export const electionAbi = [
  // Events
  {
    type: "event",
    name: "CampaignStarted",
    inputs: [
      { name: "term", type: "uint256", indexed: true },
      { name: "candidate", type: "address", indexed: true },
      { name: "bribePerVote", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "term", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: true },
      { name: "candidate", type: "address", indexed: true },
      { name: "bribe", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BribePerVoteUpdated",
    inputs: [
      { name: "term", type: "uint256", indexed: true },
      { name: "candidate", type: "address", indexed: true },
      { name: "oldBribe", type: "uint256", indexed: false },
      { name: "newBribe", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CampaignFunded",
    inputs: [
      { name: "term", type: "uint256", indexed: true },
      { name: "candidate", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  // View functions
  {
    type: "function",
    name: "currentTerm",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentKing",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentKingVoterCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "blocksRemainingInTerm",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCandidateCount",
    inputs: [{ name: "term", type: "uint256" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCandidateList",
    inputs: [{ name: "term", type: "uint256" }],
    outputs: [{ type: "address[]" }],
    stateMutability: "view",
  },
] as const;
