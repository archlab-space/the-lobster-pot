"use client";

import { Box, Users, Landmark, TrendingUp } from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { formatKrill, formatBlock, formatTaxRate } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function PulseItem({
  icon: Icon,
  label,
  children,
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  tooltip?: string;
}) {
  const content = (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  );

  if (!tooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function SystemPulse() {
  const { state } = useGameState();

  return (
    <div className="flex shrink-0 items-center gap-4">
      <PulseItem icon={Box} label="BLOCK" tooltip="Current block height">
        <AnimatedNumber value={state.blockHeight} format={formatBlock} />
      </PulseItem>
      <PulseItem icon={Landmark} label="TREASURY" tooltip="Total KRILL in treasury">
        <AnimatedNumber
          value={state.treasury}
          format={(n) => formatKrill(n)}
          className="text-krill"
        />
      </PulseItem>
      <PulseItem icon={TrendingUp} label="TAX" tooltip="Current tax rate">
        <span className="text-danger">{formatTaxRate(state.taxRate)}</span>
      </PulseItem>
      <PulseItem icon={Users} label="ALIVE" tooltip="Active players">
        <span>{state.activePlayers}</span>
      </PulseItem>
    </div>
  );
}
