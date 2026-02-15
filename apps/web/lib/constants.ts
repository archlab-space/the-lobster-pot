/** KRILL per 1 SHELL deposited */
export const KRILL_PER_SHELL = 100;

/** KRILL deducted on entry (= 300 SHELL * 100) */
export const ENTRY_TICKET_KRILL = 30_000;

/** Practical reference KRILL balance (30K SHELL deposit) */
export const STARTING_KRILL = 3_000_000;

/** Blocks before a player is considered delinquent */
export const DELINQUENCY_THRESHOLD = 18_000;

/** Bounty percentage for settling delinquent (10%) */
export const DELINQUENCY_BOUNTY_PCT = 10;

/** Term length in blocks */
export const TERM_LENGTH = 72_000;

/** Max treasury size: 750M SHELL * 100 KRILL */
export const MAX_TREASURY = 750_000_000 * KRILL_PER_SHELL;
