import { Router } from "express";
import { authLimiter } from "../../middlewares/error";
import { asyncHandler } from "../../utils/helpers";
import { ok } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { audit } from "../audit/audit";

const router = Router();
router.use(authenticate);

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function period(q: any) {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

// GET /api/admin/reports/summary?from=&to=
router.get(
  "/summary",
  authorize("reports"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { from, to } = period(req.query);
    const todayStart = startOfDay();

    const revenueFilter = { orderStatus: { not: "CANCELLED" }, createdAt: { gte: from, lte: to } };
    const [periodOrders, todayOrders, totalOrders, lowStock, totalProducts, totalCustomers] = await Promise.all([
      prisma.order.aggregate({ where: revenueFilter, _sum: { grandTotal: true }, _count: true }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, orderStatus: { not: "CANCELLED" } }, _sum: { grandTotal: true }, _count: true }),
      prisma.order.count({ where: { orderStatus: { not: "CANCELLED" } } }),
      prisma.product.count({ where: { active: true, deletedAt: null, stock: { lte: 10 } } }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.customer.count(),
    ]);

    const report = {
      period: { from, to },
      periodRevenue: Number(periodOrders._sum.grandTotal ?? 0),
      periodOrders: periodOrders._count,
      todayRevenue: Number(todayOrders._sum.grandTotal ?? 0),
      todayOrders: todayOrders._count,
      totalOrders,
      totalProducts,
      totalCustomers,
      lowStockProducts: lowStock,
    };
    await audit(req.admin!.id, "READ", "Report", null, "Viewed dashboard summary");
    return ok(res, report);
  })
);

// GET /api/admin/reports/revenue?from=&to=  → daily revenue series
router.get(
  "/revenue",
  authorize("reports"),
  asyncHandler(async (req, res) => {
    const { from, to } = period(req.query);
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to }, orderStatus: { not: "CANCELLED" } },
      select: { createdAt: true, grandTotal: true },
      orderBy: { createdAt: "asc" },
    });
    const byDay: Record<string, { revenue: number; orders: number }> = {};
    for (const o of orders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { revenue: 0, orders: 0 };
      byDay[day].revenue += Number(o.grandTotal);
      byDay[day].orders += 1;
    }
    const series = Object.entries(byDay).map(([date, v]) => ({ date, revenue: Math.round(v.revenue * 100) / 100, orders: v.orders }));
    return ok(res, { series, total: series.reduce((s, x) => s + x.revenue, 0) });
  })
);

// GET /api/admin/reports/top-products?from=&to=&limit=
router.get(
  "/top-products",
  authorize("reports"),
  asyncHandler(async (req, res) => {
    const { from, to } = period(req.query);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const items = await prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { order: { createdAt: { gte: from, lte: to }, orderStatus: { not: "CANCELLED" } } },
      _sum: { quantity: true, total: true },
      _count: true,
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });
    return ok(res, { items });
  })
);

// GET /api/admin/reports/top-categories?from=&to=
router.get(
  "/top-categories",
  authorize("reports"),
  asyncHandler(async (req, res) => {
    const { from, to } = period(req.query);
    const items = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { createdAt: { gte: from, lte: to }, orderStatus: { not: "CANCELLED" } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 50,
    });
    const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, category: { select: { id: true, name: true } } },
    });
    const catMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const i of items) {
      const prod = products.find((p) => p.id === i.productId);
      const cat = prod?.category;
      const key = cat?.name ?? "Uncategorized";
      if (!catMap[key]) catMap[key] = { name: key, qty: 0, revenue: 0 };
      catMap[key].qty += i._sum.quantity ?? 0;
      catMap[key].revenue += Number(i._sum.total ?? 0);
    }
    const sorted = Object.values(catMap).sort((a, b) => b.qty - a.qty);
    return ok(res, { items: sorted });
  })
);

// GET /api/admin/reports/stock-value → total inventory value (cost & retail)
router.get(
  "/stock-value",
  authorize("reports"),
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({ where: { deletedAt: null }, select: { stock: true, buyingPrice: true, sellingPrice: true } });
    const costValue = products.reduce((s, p) => s + p.stock * Number(p.buyingPrice), 0);
    const retailValue = products.reduce((s, p) => s + p.stock * Number(p.sellingPrice), 0);
    const potentialProfit = retailValue - costValue;
    return ok(res, {
      costValue: Math.round(costValue * 100) / 100,
      retailValue: Math.round(retailValue * 100) / 100,
      potentialProfit: Math.round(potentialProfit * 100) / 100,
      productCount: products.length,
    });
  })
);

export default router;