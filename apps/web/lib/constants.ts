/** KRILL per 1 SHELL deposited */
export const KRILL_PER_SHELL = 100;

/** Minimum SHELL to enter the game */
export const ENTRY_TICKET = 1_000;

/** Starting KRILL for ENTRY_TICKET */
export const STARTING_KRILL = ENTRY_TICKET * KRILL_PER_SHELL;

/** Tax rate denominator (basis points: 10000 = 100%) */
export const TAX_RATE_DENOMINATOR = 10_000;

/** Default tax rate in basis points (2% = 200bp) */
export const DEFAULT_TAX_RATE = 200;

/** Blocks before a player is considered delinquent */
export const DELINQUENCY_THRESHOLD = 3_600;

/** Bounty percentage for settling delinquent (10%) */
export const DELINQUENCY_BOUNTY_PCT = 10;

/** Term length in blocks */
export const TERM_LENGTH = 43_200;

/** Max treasury size: 750M SHELL * 100 KRILL */
export const MAX_TREASURY = 750_000_000 * KRILL_PER_SHELL;

/** Number of agents in the simulation */
export const AGENT_COUNT_MIN = 25;
export const AGENT_COUNT_MAX = 35;

/** KRILL balance range for initial agents */
export const INITIAL_KRILL_MIN = 5_000;
export const INITIAL_KRILL_MAX = 50_000;
