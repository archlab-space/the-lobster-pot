import { formatKrill } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STARTING_KRILL } from "@/lib/constants";

interface KrillAmountProps {
  amount: number;
  className?: string;
  showUnit?: boolean;
}

export function KrillAmount({
  amount,
  className,
  showUnit = true,
}: KrillAmountProps) {
  const ratio = amount / STARTING_KRILL;
  const colorClass =
    ratio > 0.4
      ? "text-krill"
      : ratio > 0.15
        ? "text-danger"
        : "text-death";

  return (
    <span className={cn("tabular-nums", colorClass, className)}>
      {formatKrill(amount)}
      {showUnit && <span className="text-muted-foreground ml-0.5">K</span>}
    </span>
  );
}
