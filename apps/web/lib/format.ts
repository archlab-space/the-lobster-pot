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
