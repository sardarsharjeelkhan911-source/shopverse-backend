import { Router } from "express";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { validateBody } from "../../middlewares/validate";
import { orderCreateSchema } from "./order.schema";
import { createStoreOrder, serializeOrder } from "./order.service";
import { authenticateCustomer, CustomerRequest } from "../customers/customer.auth";

const router = Router();

// POST /api/store/orders
router.post(
  "/",
  validateBody(orderCreateSchema),
  asyncHandler(async (req: CustomerRequest, res) => {
    const body = req.body;
    // Allow authenticated customer to link the order to their account
    const order = await createStoreOrder({
      sessionId: body.sessionId,
      customer: body.customer?.email ? body.customer : req.customer ? { id: req.customer.id, name: req.customer.name, email: req.customer.email } : undefined,
      address: body.address,
      items: body.items,
      couponCode: body.couponCode,
      paymentMethod: body.paymentMethod,
      note: body.note,
    });
    return ok(res, serializeOrder(order), "Order placed", 201);
  })
);

// GET /api/store/orders/track/:orderNumber
router.get(
  "/track/:orderNumber",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: { items: true, statusLogs: { orderBy: { createdAt: "asc" } } },
    });
    if (!order) return fail(res, "Order not found", 404);
    return ok(res, serializeOrder(order));
  })
);

// GET /api/store/orders/my (customer account orders)
router.get(
  "/my",
  authenticateCustomer,
  asyncHandler(async (req: CustomerRequest, res) => {
    const orders = await prisma.order.findMany({
      where: { customerId: req.customer!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: true },
    });
    return ok(res, { items: orders.map(serializeOrder) });
  })
);

export default router;