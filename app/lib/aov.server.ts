type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

/**
 * Average order value from paid orders in the last `days` days (Admin GraphQL).
 */
export async function calculateAverageOrderValue(
  graphql: AdminGraphql,
  days = 30,
): Promise<{ aov: number | null; orderCount: number }> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateStr = since.toISOString().split("T")[0];
  const queryStr = `created_at:>=${dateStr} financial_status:paid`;

  let total = 0;
  let count = 0;
  let cursor: string | null = null;
  const maxPages = 20;

  for (let page = 0; page < maxPages; page++) {
    const response = await graphql(
      `#graphql
        query OrdersForAOV($first: Int!, $query: String, $after: String) {
          orders(first: $first, query: $query, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                totalPriceSet {
                  shopMoney {
                    amount
                  }
                }
              }
            }
          }
        }`,
      {
        variables: {
          first: 50,
          query: queryStr,
          after: cursor,
        },
      },
    );

    const json = (await response.json()) as {
      data?: {
        orders?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          edges: Array<{
            node: { totalPriceSet: { shopMoney: { amount: string } } };
          }>;
        };
      };
      errors?: unknown;
    };

    if (json.errors) {
      console.error("AOV GraphQL errors", json.errors);
      break;
    }

    const orders = json.data?.orders;
    if (!orders?.edges?.length) break;

    for (const edge of orders.edges) {
      const amount = Number(edge.node.totalPriceSet.shopMoney.amount);
      if (!Number.isNaN(amount)) {
        total += amount;
        count += 1;
      }
    }

    if (!orders.pageInfo.hasNextPage || !orders.pageInfo.endCursor) break;
    cursor = orders.pageInfo.endCursor;
  }

  if (count === 0) return { aov: null, orderCount: 0 };
  return { aov: total / count, orderCount: count };
}
