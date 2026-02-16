export declare const monadTestnet: {
    blockExplorers?: {
        [key: string]: {
            name: string;
            url: string;
            apiUrl?: string | undefined;
        };
        default: {
            name: string;
            url: string;
            apiUrl?: string | undefined;
        };
    } | undefined | undefined;
    blockTime?: number | undefined | undefined;
    contracts?: {
        [x: string]: import("viem").ChainContract | {
            [sourceId: number]: import("viem").ChainContract | undefined;
        } | undefined;
        ensRegistry?: import("viem").ChainContract | undefined;
        ensUniversalResolver?: import("viem").ChainContract | undefined;
        multicall3?: import("viem").ChainContract | undefined;
        erc6492Verifier?: import("viem").ChainContract | undefined;
    } | undefined;
    ensTlds?: readonly string[] | undefined;
    id: 41454;
    name: "Monad Testnet";
    nativeCurrency: {
        readonly name: "MON";
        readonly symbol: "MON";
        readonly decimals: 18;
    };
    experimental_preconfirmationTime?: number | undefined | undefined;
    rpcUrls: {
        readonly default: {
            readonly http: readonly ["https://testnet-rpc.monad.xyz"];
            readonly webSocket: readonly ["wss://testnet-rpc.monad.xyz"];
        };
    };
    sourceId?: number | undefined | undefined;
    testnet?: boolean | undefined | undefined;
    custom?: Record<string, unknown> | undefined;
    extendSchema?: Record<string, unknown> | undefined;
    fees?: import("viem").ChainFees<undefined> | undefined;
    formatters?: undefined;
    prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
        runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
    }] | undefined;
    serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
    verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
};
export declare const contracts: {
    shellToken: "0xf19064B0673ffF053BCbB0aaB3f9E8Bd4c923ace";
    gameCore: "0x78ab3a36B4DD7bB2AD45808F9C5dAe9a1c075C19";
    election: "0xa814d0189efba4547b78972b06433868823a28DF";
};
export declare const EXCHANGE_RATE = 100n;
export declare const EXIT_TAX_BPS = 2000n;
export declare const ENTRY_TICKET: bigint;
export declare const INSOLVENCY_THRESHOLD: bigint;
export declare const YIELD_PER_BLOCK: bigint;
export declare const MIN_TAX_RATE: bigint;
export declare const MAX_TAX_RATE: bigint;
export declare const MAX_KRILL_FROM_YIELD: bigint;
export declare const DELINQUENCY_GRACE_PERIOD = 18000n;
export declare const DELINQUENCY_BOUNTY_BPS = 1000n;
export declare const TERM_DURATION = 72000n;
export declare const REGISTRATION_FEE: bigint;
export declare const VOTER_MIN_BALANCE: bigint;
export declare const MIN_VOTER_AGE = 100n;
//# sourceMappingURL=config.d.ts.map