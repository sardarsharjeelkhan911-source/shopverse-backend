import { Router } from "express";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateBody, validateQuery } from "../../middlewares/validate";
import { inventoryMovementQuery, stockAdjustSchema } from "./inventory.schema";
import { paginateArgs, meta } from "../../utils/pagination";
import { adjustStock } from "../products/product.service";
import { audit } from "../audit/audit";

export const adminRouter = Router();
adminRouter.use(authenticate);

adminRouter.get(
  "/movements",
  authorize("inventory"),
  validateQuery(inventoryMovementQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = {
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.from || q.to
        ? { createdAt: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { id: true, name: true, sku: true, slug: true } } },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);
    return ok(
      res,
      {
        items: items.map((m) => ({
          id: m.id,
          productId: m.productId,
          product: m.product,
          type: m.type,
          quantity: m.quantity,
          stockBefore: m.stockBefore,
          stockAfter: m.stockAfter,
          cost: m.cost === null ? null : Number(m.cost),
          reason: m.reason,
          createdAt: m.createdAt,
        })),
        ...meta(q, total),
      }
    );
  })
);

adminRouter.post(
  "/adjust",
  authorize("inventory"),
  validateBody(stockAdjustSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { productId, type, quantity, reason, cost } = req.body;
    const signed = type === "OUT" ? -quantity : type === "ADJUST" ? quantity : quantity;

    const result = await prisma.$transaction(async (tx) => {
      const next = await adjustStock(tx, productId, signed, type, reason, req.admin!.id, cost ?? undefined);
      return next;
    });
    await audit(req.admin!.id, "INVENTORY", "Product", productId, `${type} ${quantity} units: ${reason}`);
    return ok(res, { productId, type, quantity, stockAfter: result }, "Stock updated", 201);
  })
);

adminRouter.get(
  "/low-stock",
  authorize("inventory"),
  asyncHandler(async (req, res) => {
    const threshold = Math.max(0, Number(req.query.threshold) || 10);
    const items = await prisma.product.findMany({
      where: { deletedAt: null, active: true, stock: { lte: threshold } },
      orderBy: { stock: "asc" },
      include: { category: { select: { id: true, name: true } } },
    });
    return ok(res, { items, total: items.length, threshold });
  })
);

export default adminRouter;