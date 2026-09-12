import { Router } from "express";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateBody, validateQuery } from "../../middlewares/validate";
import { taxRuleSchema, taxRuleQuery } from "./tax.schema";
import { paginateArgs, meta } from "../../utils/pagination";
import { audit } from "../audit/audit";

export const adminRouter = Router();
adminRouter.use(authenticate);

function serialize(rule: any) {
  return {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    rate: Number(rule.rate),
    fixedAmount: rule.fixedAmount === null ? null : Number(rule.fixedAmount),
    appliesTo: rule.appliesTo,
    categoryId: rule.categoryId,
    category: rule.category ? { id: rule.category.id, name: rule.category.name } : null,
    productId: rule.productId,
    product: rule.product ? { id: rule.product.id, name: rule.product.name } : null,
    isInclusive: rule.isInclusive,
    rounding: rule.rounding,
    active: rule.active,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

const include = {
  category: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
};

adminRouter.get(
  "/",
  authorize("settings"),
  validateQuery(taxRuleQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = q.search ? { name: { contains: q.search } } : {};
    const [items, total] = await Promise.all([
      prisma.taxRule.findMany({ where, take, skip, orderBy: { createdAt: "desc" }, include }),
      prisma.taxRule.count({ where }),
    ]);
    return ok(res, { items: items.map(serialize), ...meta(q, total) });
  })
);

adminRouter.post(
  "/",
  authorize("settings"),
  validateBody(taxRuleSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const rule = await prisma.taxRule.create({ data: req.body, include });
    await audit(req.admin!.id, "CREATE", "TaxRule", rule.id, `Created tax rule ${rule.name}`);
    return ok(res, serialize(rule), "Tax rule created", 201);
  })
);

adminRouter.put(
  "/:id",
  authorize("settings"),
  validateBody(taxRuleSchema.partial()),
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.taxRule.findUnique({ where: { id: req.params.id } });
    if (!existing) return fail(res, "Tax rule not found", 404);
    const rule = await prisma.taxRule.update({ where: { id: req.params.id }, data: req.body, include });
    await audit(req.admin!.id, "UPDATE", "TaxRule", rule.id, `Updated tax rule ${rule.name}`);
    return ok(res, serialize(rule), "Tax rule updated");
  })
);

adminRouter.delete(
  "/:id",
  authorize("settings"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const rule = await prisma.taxRule.findUnique({ where: { id: req.params.id } });
    if (!rule) return fail(res, "Tax rule not found", 404);
    await prisma.taxRule.delete({ where: { id: req.params.id } });
    await audit(req.admin!.id, "DELETE", "TaxRule", req.params.id, `Deleted tax rule ${rule.name}`);
    return ok(res, null, "Tax rule deleted");
  })
);

export default adminRouter;