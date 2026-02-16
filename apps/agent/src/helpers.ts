import { EXCHANGE_RATE } from "./config.js";

const DECIMALS = 18n;
const ONE = 10n ** DECIMALS;

/** Parse a human-readable KRILL string (e.g. "1000.5") to raw bigint (18 decimals) */
export function parseKrill(amount: string): bigint {
  return parseUnits(amount, 18);
}

/** Format a raw KRILL bigint to human-readable string */
export function formatKrill(amount: bigint): string {
  return formatUnits(amount, 18);
}

/** Parse a human-readable SHELL string to raw bigint (18 decimals) */
export function parseShell(amount: string): bigint {
  return parseUnits(amount, 18);
}

/** Format a raw SHELL bigint to human-readable string */
export function formatShell(amount: bigint): string {
  return formatUnits(amount, 18);
}

/** Convert SHELL amount (raw) to KRILL amount (raw). 1 SHELL = 100 KRILL */
export function shellToKrill(shellAmount: bigint): bigint {
  return shellAmount * EXCHANGE_RATE;
}

/** Convert KRILL amount (raw) to SHELL amount (raw). 100 KRILL = 1 SHELL (truncates) */
export function krillToShell(krillAmount: bigint): bigint {
  return krillAmount / EXCHANGE_RATE;
}

function parseUnits(value: string, decimals: number): bigint {
  const [whole, fraction = ""] = value.split(".");
  const trimmed = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole + trimmed);
}

function formatUnits(value: bigint, decimals: number): string {
  const str = value.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals);
  const fraction = str.slice(str.length - decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
