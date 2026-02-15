/**
 * GraphQL client for querying the Envio indexer
 */

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function graphqlQuery<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch("/api/graphql", {
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
      GlobalState_by_pk(id: "GLOBAL") {
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
      Player(where: {isActive: {_eq: true}}, limit: 1000, order_by: {krillBalance: desc}) {
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
      Death(limit: $first, order_by: {block: desc}) {
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
      ActivityEvent(limit: $first, order_by: {block: desc}) {
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
      Term_by_pk(id: $termNumber) {
        termNumber
        totalCandidates
        totalVotes
        candidates(order_by: {voteCount: desc}) {
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
      Player(
        where: {isActive: {_eq: true}}
        limit: 10
        order_by: {killCount: desc}
      ) {
        address
        killCount
      }
    }
  `,
};
