import { Router } from "express";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateBody, validateQuery } from "../../middlewares/validate";
import { brandSchema, brandQuery } from "./brand.schema";
import { paginateArgs, meta } from "../../utils/pagination";
import { slugify } from "../../utils/helpers";
import { audit } from "../audit/audit";

function serialize(b: any) {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    logo: b.logo,
    description: b.description,
    active: b.active,
    productCount: b._count?.products ?? 0,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

// ===================== Public store =====================
export const publicRouter = Router();

publicRouter.get(
  "/",
  validateQuery(brandQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = { ...(q.search ? { name: { contains: q.search } } : {}) };
    const [items, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        take,
        skip,
        orderBy: { name: "asc" },
        include: { _count: { select: { products: { where: { deletedAt: null } } } } },
      }),
      prisma.brand.count({ where }),
    ]);
    return ok(res, { items: items.map(serialize), ...meta(q, total) });
  })
);

// ===================== Admin =====================
export const adminRouter = Router();
adminRouter.use(authenticate);

adminRouter.get(
  "/",
  validateQuery(brandQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = { ...(q.search ? { name: { contains: q.search } } : {}) };
    const [items, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        take,
        skip,
        orderBy: { name: "asc" },
        include: { _count: { select: { products: { where: { deletedAt: null } } } } },
      }),
      prisma.brand.count({ where }),
    ]);
    return ok(res, { items: items.map(serialize), ...meta(q, total) });
  })
);

adminRouter.post(
  "/",
  authorize("brands"),
  validateBody(brandSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = req.body;
    const slug = body.slug || slugify(body.name);
    const dup = await prisma.brand.findUnique({ where: { slug } });
    if (dup) return fail(res, "Brand slug already exists", 409);
    const brand = await prisma.brand.create({
      data: { name: body.name, slug, logo: body.logo ?? null, description: body.description ?? null, active: body.active },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    await audit(req.admin!.id, "CREATE", "Brand", brand.id, `Created brand ${brand.name}`);
    return ok(res, serialize(brand), "Brand created", 201);
  })
);

adminRouter.put(
  "/:id",
  authorize("brands"),
  validateBody(brandSchema.partial()),
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.brand.findUnique({ where: { id: req.params.id } });
    if (!existing) return fail(res, "Brand not found", 404);
    const body = req.body;
    const payload: any = { ...body };
    if (body.name && !body.slug) payload.slug = slugify(body.name);
    const brand = await prisma.brand.update({ where: { id: req.params.id }, data: payload, include: { _count: { select: { products: { where: { deletedAt: null } } } } } });
    await audit(req.admin!.id, "UPDATE", "Brand", brand.id, `Updated brand ${brand.name}`);
    return ok(res, serialize(brand), "Brand updated");
  })
);

adminRouter.delete(
  "/:id",
  authorize("brands"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const brand = await prisma.brand.findUnique({
      where: { id: req.params.id },
      include: { products: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!brand) return fail(res, "Brand not found", 404);
    if (brand.products.length > 0) return fail(res, "Brand has products. Reassign them first.", 409);
    await prisma.brand.delete({ where: { id: req.params.id } });
    await audit(req.admin!.id, "DELETE", "Brand", req.params.id, `Deleted brand ${brand.name}`);
    return ok(res, null, "Brand deleted");
  })
);

export default publicRouter;