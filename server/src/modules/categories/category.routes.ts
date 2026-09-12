import { Router } from "express";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateBody, validateQuery } from "../../middlewares/validate";
import { categorySchema, categoryQuery } from "./category.schema";
import { paginateArgs, meta } from "../../utils/pagination";
import { slugify } from "../../utils/helpers";
import { audit } from "../audit/audit";

const categoryInclude = {
  parent: { select: { id: true, name: true, slug: true } },
  _count: { select: { products: { where: { deletedAt: null } } } },
};

export function serializeCategory(c: any) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    parentId: c.parentId,
    parent: c.parent,
    active: c.active,
    sortOrder: c.sortOrder,
    productCount: c._count?.products ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// ===================== Public store =====================
export const publicRouter = Router();

publicRouter.get(
  "/",
  validateQuery(categoryQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = { deletedAt: null, active: true, ...(q.search ? { name: { contains: q.search } } : {}) };
    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        take,
        skip,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: categoryInclude,
      }),
      prisma.category.count({ where }),
    ]);
    return ok(res, { items: items.map(serializeCategory), ...meta(q, total) });
  })
);

publicRouter.get(
  "/tree",
  asyncHandler(async (_req, res) => {
    const cats = await prisma.category.findMany({ where: { deletedAt: null, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const byId = new Map<string, any>();
    cats.forEach((c) => byId.set(c.id, { ...c, children: [] }));
    const roots: any[] = [];
    byId.forEach((node) => {
      if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
      else roots.push(node);
    });
    return ok(res, { items: roots.map((r) => ({ ...r, _count: undefined })) });
  })
);

// ===================== Admin =====================
export const adminRouter = Router();
adminRouter.use(authenticate);

adminRouter.get(
  "/",
  authorize("categories"),
  validateQuery(categoryQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = {
      deletedAt: null,
      ...(q.active !== undefined ? { active: q.active } : {}),
      ...(q.search ? { name: { contains: q.search } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.category.findMany({ where, take, skip, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: categoryInclude }),
      prisma.category.count({ where }),
    ]);
    return ok(res, { items: items.map(serializeCategory), ...meta(q, total) });
  })
);

adminRouter.post(
  "/",
  authorize("categories"),
  validateBody(categorySchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = req.body;
    const slug = body.slug || slugify(body.name);
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) return fail(res, "Category slug already exists", 409);
    const cat = await prisma.category.create({
      data: {
        name: body.name,
        slug,
        description: body.description ?? null,
        image: body.image ?? null,
        parentId: body.parentId ?? null,
        active: body.active,
        sortOrder: body.sortOrder,
      },
      include: categoryInclude,
    });
    await audit(req.admin!.id, "CREATE", "Category", cat.id, `Created category ${cat.name}`);
    return ok(res, serializeCategory(cat), "Category created", 201);
  })
);

adminRouter.put(
  "/:id",
  authorize("categories"),
  validateBody(categorySchema.partial()),
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) return fail(res, "Category not found", 404);
    const body = req.body;
    const payload: any = { ...body };
    if (body.name && !body.slug) payload.slug = slugify(body.name);
    if (body.slug) {
      const dup = await prisma.category.findFirst({ where: { slug: body.slug, id: { not: req.params.id } } });
      if (dup) return fail(res, "Category slug already exists", 409);
    }
    const cat = await prisma.category.update({ where: { id: req.params.id }, data: payload, include: categoryInclude });
    await audit(req.admin!.id, "UPDATE", "Category", cat.id, `Updated category ${cat.name}`);
    return ok(res, serializeCategory(cat), "Category updated");
  })
);

adminRouter.delete(
  "/:id",
  authorize("categories"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const cat = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { products: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!cat) return fail(res, "Category not found", 404);
    if (cat.products.length > 0) return fail(res, "This category contains products. Move or delete those products first.", 409);
    await prisma.category.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    await audit(req.admin!.id, "DELETE", "Category", req.params.id, `Deleted category ${cat.name}`);
    return ok(res, null, "Category deleted");
  })
);

export default publicRouter;