/** Format a KRILL amount with commas and optional decimals */
export function formatKrill(amount: number, decimals = 0): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Truncate an address: 0x1234...5678 */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Format a block number with commas */
export function formatBlock(block: number): string {
  return block.toLocaleString("en-US");
}

/** Format basis points as percentage string */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

/** Format a tax rate (KRILL/block, already divided by 1e18) */
export function formatTaxRate(rate: number): string {
  return `${rate.toFixed(1)} KRILL/blk`;
}

/** Parse a wei string to a number safely (handles large BigInt values) */
export function parseWei(weiStr: string): number {
  try {
    return Number(BigInt(weiStr) / BigInt(1e14)) / 1e4;
  } catch {
    return parseFloat(weiStr) / 1e18;
  }
}
