import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateQuery, validateParams, validateBody } from "../../middlewares/validate";
import { paginateArgs, meta } from "../../utils/pagination";
import { audit } from "../audit/audit";

const router = Router();
router.use(authenticate);

const customerQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional().default(""),
    status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
  })
  .strict();

const idParams = z.object({ id: z.string().cuid() }).strict();

const statusSchema = z
  .object({
    status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
  })
  .strict();

function serializeCustomer(c: any) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    status: c.status,
    totalSpent: Number(c.totalSpent),
    orderCount: c._count?.orders ?? 0,
    createdAt: c.createdAt,
    lastOrderAt: c.lastOrderAt,
  };
}

router.get(
  "/",
  authorize("customers"),
  validateQuery(customerQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = {
      ...(q.search
        ? { OR: [{ name: { contains: q.search } }, { email: { contains: q.search } }, { phone: { contains: q.search } }] }
        : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { orders: true } } },
      }),
      prisma.customer.count({ where }),
    ]);
    return ok(res, { items: items.map(serializeCustomer), ...meta(q, total) });
  })
);

router.get(
  "/:id",
  authorize("customers"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        addresses: true,
        _count: { select: { orders: true } },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, orderNumber: true, grandTotal: true, orderStatus: true, paymentStatus: true, createdAt: true },
        },
      },
    });
    if (!customer) return fail(res, "Customer not found", 404);
    return ok(res, {
      ...serializeCustomer(customer),
      addresses: customer.addresses,
      recentOrders: customer.orders,
    });
  })
);

router.patch(
  "/:id/status",
  authorize("customers"),
  validateParams(idParams),
  validateBody(statusSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    const status = req.body.status;
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return fail(res, "Customer not found", 404);
    const customer = await prisma.customer.update({ where: { id }, data: { status } });
    await audit(req.admin!.id, "UPDATE", "Customer", customer.id, `Customer ${customer.email} -> ${status}`);
    return ok(res, serializeCustomer(customer), "Customer status updated");
  })
);

export default router;