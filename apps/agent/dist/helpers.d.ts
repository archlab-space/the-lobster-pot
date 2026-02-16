/** Parse a human-readable KRILL string (e.g. "1000.5") to raw bigint (18 decimals) */
export declare function parseKrill(amount: string): bigint;
/** Format a raw KRILL bigint to human-readable string */
export declare function formatKrill(amount: bigint): string;
/** Parse a human-readable SHELL string to raw bigint (18 decimals) */
export declare function parseShell(amount: string): bigint;
/** Format a raw SHELL bigint to human-readable string */
export declare function formatShell(amount: bigint): string;
/** Convert SHELL amount (raw) to KRILL amount (raw). 1 SHELL = 100 KRILL */
export declare function shellToKrill(shellAmount: bigint): bigint;
/** Convert KRILL amount (raw) to SHELL amount (raw). 100 KRILL = 1 SHELL (truncates) */
export declare function krillToShell(krillAmount: bigint): bigint;
//# sourceMappingURL=helpers.d.ts.map