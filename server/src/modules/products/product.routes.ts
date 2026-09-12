import { Router } from "express";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateBody, validateQuery } from "../../middlewares/validate";
import { productSchema, productQuery } from "./product.schema";
import { paginateArgs, meta } from "../../utils/pagination";
import { audit } from "../audit/audit";
import { createProduct, updateProduct, deleteProduct, serializeProduct } from "./product.service";
import { env } from "../../env";

// ===================== Public store =====================
export const publicRouter = Router();

publicRouter.get(
  "/",
  validateQuery(productQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = {
      deletedAt: null,
      active: true,
      ...(q.search ? { name: { contains: q.search } } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.brandId ? { brandId: q.brandId } : {}),
      ...(q.featured !== undefined ? { featured: q.featured } : {}),
      ...(q.minPrice !== undefined || q.maxPrice !== undefined
        ? { sellingPrice: { gte: q.minPrice ?? 0, lte: q.maxPrice ?? Number.MAX_SAFE_INTEGER } }
        : {}),
    };
    if (q.includeInactive === true) delete where.active;

    const orderBy = q.sortBy === "createdAt"
      ? [{ featured: "desc" as const }, { createdAt: q.sortDir }]
      : [{ featured: "desc" as const }, { [q.sortBy!]: q.sortDir }];

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take,
        skip,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    return ok(res, { items: items.map(serializeProduct), ...meta(q, total) });
  })
);

publicRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
      },
    });
    if (!product || product.deletedAt) return fail(res, "Product not found", 404);
    return ok(res, serializeProduct(product));
  })
);

// ===================== Admin =====================
export const adminRouter = Router();
adminRouter.use(authenticate);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(process.cwd(), env.UPLOAD_DIR);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

adminRouter.get(
  "/",
  authorize("products"),
  validateQuery(productQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = {
      deletedAt: null,
      ...(q.search ? { name: { contains: q.search } } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.brandId ? { brandId: q.brandId } : {}),
      ...(q.featured !== undefined ? { featured: q.featured } : {}),
    };
    if (q.includeInactive === true) delete where.active;
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: q.sortDir },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: "asc" } },
          variants: true,
        },
      }),
      prisma.product.count({ where }),
    ]);
    return ok(res, { items: items.map(serializeProduct), ...meta(q, total) });
  })
);

adminRouter.post(
  "/upload",
  authorize("products"),
  upload.single("image"),
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.file) return fail(res, "No image uploaded", 422);
    await audit(req.admin!.id, "UPLOAD", "ProductImage", req.file.filename, "Uploaded product image");
    return ok(res, { url: `/uploads/${req.file.filename}` }, "Image uploaded", 201);
  })
);

adminRouter.post(
  "/",
  authorize("products"),
  validateBody(productSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const product = await createProduct(req.body, req.admin!.id);
    return ok(res, serializeProduct(product), "Product created", 201);
  })
);

adminRouter.put(
  "/:id",
  authorize("products"),
  validateBody(productSchema.partial()),
  asyncHandler(async (req: AuthedRequest, res) => {
    const product = await updateProduct(req.params.id, req.body, req.admin!.id);
    return ok(res, serializeProduct(product), "Product updated");
  })
);

adminRouter.delete(
  "/:id",
  authorize("products"),
  asyncHandler(async (req: AuthedRequest, res) => {
    await deleteProduct(req.params.id, req.admin!.id);
    return ok(res, null, "Product deleted");
  })
);

export default publicRouter;