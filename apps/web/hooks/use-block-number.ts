"use client";

import { useEffect, useState } from "react";
import { publicClient } from "@/lib/viem";

export function useBlockNumber(): number {
  const [blockNumber, setBlockNumber] = useState(0);

  useEffect(() => {
    const unwatch = publicClient.watchBlockNumber({
      onBlockNumber: (n) => setBlockNumber(Number(n)),
    });
    return unwatch;
  }, []);

  return blockNumber;
}
