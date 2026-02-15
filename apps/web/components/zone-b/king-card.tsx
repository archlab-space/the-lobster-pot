"use client";

import { Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useGameState } from "@/hooks/use-game-state";
import { useBlockNumber } from "@/hooks/use-block-number";
import { AddressLabel } from "@/components/shared/address-label";
import { formatTaxRate } from "@/lib/format";
import { TERM_LENGTH } from "@/lib/constants";

export function KingCard() {
  const { state } = useGameState();
  const liveBlock = useBlockNumber();
  const { king } = state;
  const blockHeight = liveBlock || state.blockHeight;

  const blocksElapsed = blockHeight - king.termStartBlock;
  const termProgress = Math.min(100, (blocksElapsed / TERM_LENGTH) * 100);

  return (
    <Card className="glow-royalty border-royalty/30">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-royalty" />
          <span className="text-xs font-bold uppercase text-royalty">
            King
          </span>
          <Badge
            variant="outline"
            className="ml-auto border-royalty/30 text-[10px] text-royalty"
          >
            Term {king.term}
          </Badge>
        </div>

        <AddressLabel
          address={king.address}
          className="block text-sm font-medium text-foreground"
        />

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Term Progress</span>
            <span>{Math.round(termProgress)}%</span>
          </div>
          <Progress value={termProgress} className="h-1.5" />
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Tax Rate</span>
          <span className="font-medium text-danger">
            {formatTaxRate(state.taxRate)}
          </span>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Voters</span>
          <span className="font-medium">{king.voterCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}
