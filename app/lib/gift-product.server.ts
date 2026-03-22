type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

export type GiftProductMeta = {
  handle: string;
  variantNumericId: string;
  title: string;
};

/**
 * Resolve a product GID to the first variant + storefront meta for Ajax Cart.
 */
export async function resolveGiftFromProductGid(
  graphql: AdminGraphql,
  productGid: string,
): Promise<{
  giftProductId: string;
  giftVariantId: string;
  meta: GiftProductMeta;
} | null> {
  if (!productGid?.startsWith("gid://")) return null;

  const response = await graphql(
    `#graphql
      query GiftProduct($id: ID!) {
        product(id: $id) {
          id
          handle
          title
          variants(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
      }`,
    { variables: { id: productGid } },
  );

  const json = (await response.json()) as {
    data?: {
      product?: {
        id: string;
        handle: string;
        title: string;
        variants?: {
          edges: Array<{ node: { id: string } }>;
        };
      } | null;
    };
    errors?: unknown;
  };

  if (json.errors) {
    console.error("resolveGiftFromProductGid", json.errors);
    return null;
  }

  const p = json.data?.product;
  const v = p?.variants?.edges?.[0]?.node;
  if (!p?.handle || !v?.id) return null;

  const variantNumeric =
    (v.id.includes("/") ? v.id.split("/").pop() : "") ?? "";

  return {
    giftProductId: p.id,
    giftVariantId: v.id,
    meta: {
      handle: p.handle,
      variantNumericId: String(variantNumeric),
      title: p.title ?? "",
    },
  };
}
