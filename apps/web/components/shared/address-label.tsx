import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AddressLabelProps {
  address: string;
  className?: string;
}

export function AddressLabel({ address, className }: AddressLabelProps) {
  return (
    <span className={cn("text-muted-foreground text-xs", className)}>
      {truncateAddress(address)}
    </span>
  );
}
