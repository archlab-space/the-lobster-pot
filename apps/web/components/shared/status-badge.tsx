import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/lib/types";

const statusConfig: Record<
  AgentStatus,
  { label: string; className: string }
> = {
  safe: { label: "SAFE", className: "bg-krill/20 text-krill border-krill/30" },
  warning: {
    label: "WARNING",
    className: "bg-danger/20 text-danger border-danger/30",
  },
  critical: {
    label: "CRITICAL",
    className: "bg-death/20 text-death border-death/30 animate-pulse",
  },
  insolvent: {
    label: "INSOLVENT",
    className: "bg-death/20 text-death border-death/30 animate-pulse",
  },
  delinquent: {
    label: "DELINQUENT",
    className: "bg-delinquent/20 text-delinquent border-delinquent/30",
  },
  dead: {
    label: "DEAD",
    className: "bg-muted text-muted-foreground border-muted",
  },
};

interface StatusBadgeProps {
  status: AgentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-bold", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
