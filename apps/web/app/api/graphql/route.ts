import { NextResponse } from "next/server";

const GRAPHQL_ENDPOINT =
  process.env.GRAPHQL_ENDPOINT || "http://localhost:8080";

const CACHE_TTL_MS = 3_000;
const CLEANUP_INTERVAL_MS = 60_000;

interface CacheEntry {
  data: unknown | null;
  status: number | null;
  resolvedAt: number | null;
  promise: Promise<void>;
}

const cache = new Map<string, CacheEntry>();

// Periodic cleanup — guard against HMR duplication
const CLEANUP_KEY = "__graphql_cache_cleanup" as const;
if (!(globalThis as Record<string, unknown>)[CLEANUP_KEY]) {
  (globalThis as Record<string, unknown>)[CLEANUP_KEY] = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.resolvedAt && now - entry.resolvedAt > CACHE_TTL_MS * 2) {
        cache.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

export async function POST(request: Request) {
  const body = await request.json();
  const cacheKey = JSON.stringify(body);
  const now = Date.now();

  const existing = cache.get(cacheKey);

  // Cache hit — still fresh
  if (
    existing?.data !== null &&
    existing?.data !== undefined &&
    existing?.resolvedAt &&
    now - existing.resolvedAt < CACHE_TTL_MS
  ) {
    return NextResponse.json(existing.data, {
      status: existing.status ?? 200,
    });
  }

  // In-flight request — coalesce
  if (existing && existing.data === null && existing.resolvedAt === null) {
    await existing.promise;
    const coalesced = cache.get(cacheKey);
    if (coalesced?.data !== null && coalesced?.data !== undefined) {
      return NextResponse.json(coalesced.data, {
        status: coalesced.status ?? 200,
      });
    }
    // Upstream failed during coalesced wait — fall through to return error
    return NextResponse.json(
      { error: "Upstream request failed" },
      { status: 502 }
    );
  }

  // Miss or stale — initiate fetch
  let resolve: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });

  const entry: CacheEntry = {
    data: null,
    status: null,
    resolvedAt: null,
    promise,
  };
  cache.set(cacheKey, entry);

  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    // Don't cache error responses
    if (!res.ok || data.errors) {
      cache.delete(cacheKey);
      resolve!();
      return NextResponse.json(data, { status: res.status });
    }

    entry.data = data;
    entry.status = res.status;
    entry.resolvedAt = Date.now();
    resolve!();

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    cache.delete(cacheKey);
    resolve!();
    return NextResponse.json(
      { error: "Failed to fetch from upstream" },
      { status: 502 }
    );
  }
}
