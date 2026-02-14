/**
 * GraphQL client for querying the Envio indexer
 */

// Default to localhost during development
// In production, this should be set via environment variable
const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:8080";

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function graphqlQuery<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const json: GraphQLResponse<T> = await response.json();

  if (json.errors) {
    throw new Error(`GraphQL Error: ${json.errors[0].message}`);
  }

  if (!json.data) {
    throw new Error("No data returned from GraphQL query");
  }

  return json.data;
}

// GraphQL query strings
export const QUERIES = {
  GLOBAL_HUD: `
    query GlobalHUD {
      globalState(id: "GLOBAL") {
        treasury
        taxRate
        activePlayers
        currentBlock
        currentKing
        currentTerm
        termStartBlock
        termEndBlock
      }
    }
  `,

  ACTIVE_PLAYERS: `
    query ActivePlayers {
      players(where: { isActive: true }, first: 1000, orderBy: krillBalance, orderDirection: desc) {
        id
        address
        krillBalance
        effectiveBalance
        status
        isDelinquent
        killCount
        entryCount
        joinedBlock
        lastTaxBlock
      }
    }
  `,

  KILL_FEED: `
    query KillFeed($first: Int = 20) {
      deaths(first: $first, orderBy: block, orderDirection: desc) {
        id
        victim {
          address
        }
        killer {
          address
        }
        cause
        krillAtDeath
        bountyEarned
        block
        timestamp
      }
    }
  `,

  NEWS_TICKER: `
    query NewsTicker($first: Int = 50) {
      activityEvents(first: $first, orderBy: block, orderDirection: desc) {
        id
        eventType
        block
        timestamp
        data
        primaryAddress
        secondaryAddress
        amount
      }
    }
  `,

  CURRENT_ELECTION: `
    query CurrentElection($termNumber: String!) {
      term(id: $termNumber) {
        termNumber
        totalCandidates
        totalVotes
        candidates(orderBy: voteCount, orderDirection: desc) {
          candidate {
            address
          }
          bribePerVote
          campaignFunds
          voteCount
          isLeading
        }
      }
    }
  `,

  LEADERBOARD: `
    query Leaderboard {
      players(
        where: { isActive: true }
        first: 10
        orderBy: killCount
        orderDirection: desc
      ) {
        address
        killCount
      }
    }
  `,
};
