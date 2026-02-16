import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://testnet-rpc.monad.xyz"],
      webSocket: ["wss://testnet-rpc.monad.xyz"],
    },
  },
});

export const contracts = {
  shellToken: "0xf19064B0673ffF053BCbB0aaB3f9E8Bd4c923ace" as const,
  gameCore: "0x78ab3a36B4DD7bB2AD45808F9C5dAe9a1c075C19" as const,
  election: "0xa814d0189efba4547b78972b06433868823a28DF" as const,
};

// Game constants (mirrored from GameCore.sol)
export const EXCHANGE_RATE = 100n;
export const EXIT_TAX_BPS = 2000n;
export const ENTRY_TICKET = 30_000n * 10n ** 18n;
export const INSOLVENCY_THRESHOLD = 1_000n * 10n ** 18n;
export const YIELD_PER_BLOCK = 200n * 10n ** 18n;
export const MIN_TAX_RATE = 1n * 10n ** 18n;
export const MAX_TAX_RATE = 5n * 10n ** 18n;
export const MAX_KRILL_FROM_YIELD = 750_000_000n * EXCHANGE_RATE * 10n ** 18n;
export const DELINQUENCY_GRACE_PERIOD = 18000n;
export const DELINQUENCY_BOUNTY_BPS = 1000n;

// Election constants (mirrored from Election.sol)
export const TERM_DURATION = 72_000n;
export const REGISTRATION_FEE = 1_000_000n * 10n ** 18n;
export const VOTER_MIN_BALANCE = 1_000n * 10n ** 18n;
export const MIN_VOTER_AGE = 100n;
