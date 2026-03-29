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

/**
 * Daily time series for the analytics chart.
 * Returns an array of { date, drawerOpens, upsellAdds, checkoutClicks, ordersCompleted }.
 */
export async function getAnalyticsTimeSeries(shopId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await prisma.analyticsEvent.findMany({
    where: { shopId, createdAt: { gte: since } },
    select: { eventType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Build a map of date → counts
  const dayMap: Record<
    string,
    { drawerOpens: number; upsellAdds: number; checkoutClicks: number; ordersCompleted: number }
  > = {};

  // Pre-fill all days so the chart has no gaps
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().split("T")[0];
    dayMap[key] = { drawerOpens: 0, upsellAdds: 0, checkoutClicks: 0, ordersCompleted: 0 };
  }

  for (const ev of events) {
    const key = ev.createdAt.toISOString().split("T")[0];
    if (!dayMap[key]) {
      dayMap[key] = { drawerOpens: 0, upsellAdds: 0, checkoutClicks: 0, ordersCompleted: 0 };
    }
    const day = dayMap[key];
    switch (ev.eventType) {
      case "drawer_open":
        day.drawerOpens++;
        break;
      case "upsell_added":
        day.upsellAdds++;
        break;
      case "checkout_click":
        day.checkoutClicks++;
        break;
      case "order_completed":
        day.ordersCompleted++;
        break;
    }
  }

  return Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));
}

