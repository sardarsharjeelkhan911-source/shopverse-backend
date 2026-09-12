import { Router } from "express";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateBody, validateQuery, validateParams } from "../../middlewares/validate";
import { orderQuery, orderStatusSchema, paymentUpdateSchema } from "./order.schema";
import { paginateArgs, meta } from "../../utils/pagination";
import { updateOrderStatus, recordPayment, serializeOrder } from "./order.service";
import { audit } from "../audit/audit";
import { z } from "zod";

const router = Router();
router.use(authenticate);

const idParams = z.object({ id: z.string().cuid() }).strict();

router.get(
  "/",
  authorize("orders"),
  validateQuery(orderQuery),
  asyncHandler(async (req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = {
      ...(q.search
        ? {
            OR: [
              { orderNumber: { contains: q.search } },
              { customerName: { contains: q.search } },
              { customerPhone: { contains: q.search } },
              { customerEmail: { contains: q.search } },
            ],
          }
        : {}),
      ...(q.orderStatus ? { orderStatus: q.orderStatus } : {}),
      ...(q.paymentStatus ? { paymentStatus: q.paymentStatus } : {}),
      ...(q.from || q.to
        ? { createdAt: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          items: { take: 3 },
          customer: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    return ok(
      res,
      {
        items: items.map((o) => ({
          ...serializeOrder(o),
          itemCount: o.items.length,
        })),
        ...meta(q, total),
      }
    );
  })
);

router.get(
  "/:id",
  authorize("orders"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, payments: true, statusLogs: { orderBy: { createdAt: "desc" } }, customer: true },
    });
    if (!order) return fail(res, "Order not found", 404);
    return ok(res, serializeOrder(order));
  })
);

router.patch(
  "/:id/status",
  authorize("orders"),
  validateParams(idParams),
  validateBody(orderStatusSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    await updateOrderStatus(req.params.id, req.body.orderStatus, req.body.note, req.admin!.id);
    await audit(req.admin!.id, "UPDATE", "Order", req.params.id, `Order status -> ${req.body.orderStatus}`);
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true, payments: true } });
    return ok(res, serializeOrder(order), "Order status updated");
  })
);

router.post(
  "/:id/payments",
  authorize("orders"),
  validateParams(idParams),
  validateBody(paymentUpdateSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const payment = await recordPayment(req.params.id, req.body, req.admin!.id);
    await audit(req.admin!.id, "CREATE", "Payment", payment.id, `Payment recorded for order ${req.params.id}`);
    return ok(res, payment, "Payment recorded", 201);
  })
);

router.get(
  "/:id/payments",
  authorize("orders"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const payments = await prisma.payment.findMany({ where: { orderId: req.params.id }, orderBy: { createdAt: "desc" } });
    return ok(res, { items: payments });
  })
);

export default router;