type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

export type ManualProductMeta = {
  id: string;
  handle: string;
  numericId: string;
};

/**
 * Resolve Shopify Admin product GIDs to handles + numeric id for storefront `/products/{handle}.js`.
 */
export async function resolveManualProducts(
  graphql: AdminGraphql,
  productGids: string[],
): Promise<ManualProductMeta[]> {
  const out: ManualProductMeta[] = [];

  for (const gid of productGids) {
    if (!gid?.startsWith("gid://")) continue;

    const response = await graphql(
      `#graphql
        query ProductForWidget($id: ID!) {
          product(id: $id) {
            id
            handle
          }
        }`,
      { variables: { id: gid } },
    );

    const json = (await response.json()) as {
      data?: {
        product?: {
          id: string;
          handle: string;
        } | null;
      };
      errors?: unknown;
    };

    if (json.errors) {
      console.error("resolveManualProducts", json.errors);
      continue;
    }

    const p = json.data?.product;
    if (!p?.handle) continue;

    const numeric =
      (p.id.includes("/") ? p.id.split("/").pop() : "") ?? "";
    out.push({
      id: p.id,
      handle: p.handle,
      numericId: String(numeric),
    });
  }

  return out;
}
