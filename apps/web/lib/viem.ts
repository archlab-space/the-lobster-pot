import { createPublicClient, webSocket, defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 41454,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://testnet-rpc.monad.xyz"],
      webSocket: ["wss://testnet-rpc.monad.xyz"],
    },
  },
});

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: webSocket("wss://testnet-rpc.monad.xyz"),
});
