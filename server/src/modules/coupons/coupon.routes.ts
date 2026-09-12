import { Router } from "express";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateBody, validateQuery } from "../../middlewares/validate";
import { couponSchema, couponQuery } from "./coupon.schema";
import { paginateArgs, meta } from "../../utils/pagination";
import { audit } from "../audit/audit";

export const adminRouter = Router();
adminRouter.use(authenticate);

function serialize(c: any) {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: Number(c.value),
    minOrderAmount: c.minOrderAmount === null ? null : Number(c.minOrderAmount),
    maxDiscount: c.maxDiscount === null ? null : Number(c.maxDiscount),
    startsAt: c.startsAt,
    expiresAt: c.expiresAt,
    usageLimit: c.usageLimit,
    perCustomerLimit: c.perCustomerLimit,
    productId: c.productId,
    product: c.product ? { id: c.product.id, name: c.product.name } : null,
    categoryId: c.categoryId,
    category: c.category ? { id: c.category.id, name: c.category.name } : null,
    active: c.active,
    usages: c._count?.usages ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

const include = {
  product: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  _count: { select: { usages: true } },
};

adminRouter.get(
  "/",
  authorize("discounts"),
  validateQuery(couponQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = {
      ...(q.search ? { code: { contains: q.search } } : {}),
      ...(q.active !== undefined ? { active: q.active } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.coupon.findMany({ where, take, skip, orderBy: { createdAt: "desc" }, include }),
      prisma.coupon.count({ where }),
    ]);
    return ok(res, { items: items.map(serialize), ...meta(q, total) });
  })
);

adminRouter.post(
  "/",
  authorize("discounts"),
  validateBody(couponSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const dup = await prisma.coupon.findUnique({ where: { code: req.body.code } });
    if (dup) return fail(res, "Coupon code already exists", 409);
    const coupon = await prisma.coupon.create({ data: req.body, include });
    await audit(req.admin!.id, "CREATE", "Coupon", coupon.id, `Created coupon ${coupon.code}`);
    return ok(res, serialize(coupon), "Coupon created", 201);
  })
);

adminRouter.put(
  "/:id",
  authorize("discounts"),
  validateBody(couponSchema.partial()),
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!existing) return fail(res, "Coupon not found", 404);
    if (req.body.code && req.body.code !== existing.code) {
      const dup = await prisma.coupon.findUnique({ where: { code: req.body.code } });
      if (dup) return fail(res, "Coupon code already exists", 409);
    }
    const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: req.body, include });
    await audit(req.admin!.id, "UPDATE", "Coupon", coupon.id, `Updated coupon ${coupon.code}`);
    return ok(res, serialize(coupon), "Coupon updated");
  })
);

adminRouter.delete(
  "/:id",
  authorize("discounts"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon) return fail(res, "Coupon not found", 404);
    await prisma.coupon.delete({ where: { id: req.params.id } });
    await audit(req.admin!.id, "DELETE", "Coupon", req.params.id, `Deleted coupon ${coupon.code}`);
    return ok(res, null, "Coupon deleted");
  })
);

export default adminRouter;