import prisma from "../db.server";

export async function getAnalyticsSummary(shopId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [grouped, ordersAgg, drawerOpens] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["eventType"],
      where: { shopId, createdAt: { gte: since } },
      _count: { id: true },
    }),
    prisma.analyticsEvent.aggregate({
      where: {
        shopId,
        eventType: "order_completed",
        createdAt: { gte: since },
      },
      _sum: { cartTotal: true },
      _count: true,
    }),
    prisma.analyticsEvent.count({
      where: {
        shopId,
        eventType: "drawer_open",
        createdAt: { gte: since },
      },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of grouped) {
    counts[row.eventType] = row._count.id;
  }

  const upsellAdds = counts["upsell_added"] ?? 0;
  const checkouts = counts["checkout_click"] ?? 0;
  const upsellAddRate =
    drawerOpens > 0 ? Math.round((upsellAdds / drawerOpens) * 1000) / 10 : null;
  const checkoutFromDrawerRate =
    drawerOpens > 0 ? Math.round((checkouts / drawerOpens) * 1000) / 10 : null;

  return {
    days,
    since: since.toISOString(),
    counts,
    drawerOpens,
    ordersCompleted: ordersAgg._count,
    orderRevenueTotal: ordersAgg._sum.cartTotal?.toString() ?? "0",
    upsellAddRate,
    checkoutFromDrawerRate,
  };
}
