"use client";

import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Agent } from "@/lib/types";
import { STARTING_KRILL } from "@/lib/constants";
import { truncateAddress, formatKrill } from "@/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";

const statusColors: Record<string, string> = {
  safe: "#34d399",
  warning: "#f59e0b",
  critical: "#e11d48",
  insolvent: "#e11d48",
  delinquent: "#f97316",
  dead: "#475569",
};

interface AgentDotProps {
  agent: Agent;
}

export function AgentDot({ agent }: AgentDotProps) {
  const ratio = Math.max(0.3, agent.effectiveBalance / STARTING_KRILL);
  const scale = Math.min(1, 0.3 + ratio * 0.7);
  const color = statusColors[agent.status] ?? statusColors.safe;

  const isPulsing = agent.status === "insolvent" || agent.status === "critical";
  const isBlinking = agent.status === "delinquent";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          layout
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale,
            opacity: isBlinking ? [1, 0.3, 1] : 1,
          }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{
            layout: { type: "spring", stiffness: 100, damping: 15 },
            scale: { type: "spring", stiffness: 120, damping: 20 },
            opacity: isBlinking
              ? { repeat: Infinity, duration: 0.8 }
              : { duration: 0.3 },
          }}
          className="flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: isPulsing
              ? `0 0 8px ${color}, 0 0 16px ${color}40`
              : `0 0 6px ${color}40`,
          }}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="space-y-1">
        <p className="font-medium">{truncateAddress(agent.address)}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Balance:</span>
          <span className="text-krill">{formatKrill(agent.effectiveBalance)} K</span>
        </div>
        <StatusBadge status={agent.status} />
      </TooltipContent>
    </Tooltip>
  );
}
