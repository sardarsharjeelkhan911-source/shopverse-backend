import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/helpers";
import { ok } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize } from "../../middlewares/auth";
import { validateQuery } from "../../middlewares/validate";
import { paginateArgs, meta } from "../../utils/pagination";

const router = Router();
router.use(authenticate);

const auditQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    adminId: z.string().cuid().optional(),
    entityType: z.string().optional(),
    action: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();

router.get(
  "/",
  authorize("reports"),
  validateQuery(auditQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = {
      ...(q.adminId ? { adminId: q.adminId } : {}),
      ...(q.entityType ? { entityType: { contains: q.entityType } } : {}),
      ...(q.action ? { action: { contains: q.action } } : {}),
      ...(q.from || q.to
        ? { createdAt: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return ok(res, { items, ...meta(q, total) });
  })
);

export default router;