import { PrismaClient } from "@prisma/client";
import { HttpError } from "../../middlewares/error";
import { round2, nextOrderNumber } from "../../utils/helpers";
import { computeTax } from "../../lib/tax";
import { validateAndComputeCoupon } from "../coupons/coupon.service";
import { prisma } from "../../lib/prisma";
import { adjustStock } from "../products/product.service";

type OrderInput = {
  sessionId?: string;
  customer?: { id?: string; name: string; email: string; phone?: string | null };
  address: any;
  items?: { productId: string; variantId?: string | null; qty: number }[];
  couponCode?: string;
  paymentMethod: string;
  note?: string;
};

function effectivePrice(p: any) {
  if (p.salePrice && Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.sellingPrice)) {
    return Number(p.salePrice);
  }
  return Number(p.sellingPrice);
}

export function serializeOrder(o: any) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customer: o.customer ? { id: o.customer.id, name: o.customer.name, email: o.customer.email, phone: o.customer.phone } : null,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    shippingAddress: o.shippingAddress ? JSON.parse(o.shippingAddress) : null,
    subtotal: Number(o.subtotal),
    discountAmount: Number(o.discountAmount),
    couponCode: o.couponCode,
    taxAmount: Number(o.taxAmount),
    shippingAmount: Number(o.shippingAmount),
    grandTotal: Number(o.grandTotal),
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    note: o.note,
    refundedAmount: Number(o.refundedAmount),
    deliveredAt: o.deliveredAt,
    cancelledAt: o.cancelledAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: o.items?.map((i: any) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      unitPrice: Number(i.unitPrice),
      buyingPrice: Number(i.buyingPrice),
      quantity: i.quantity,
      discountAmount: Number(i.discountAmount),
      taxRate: Number(i.taxRate),
      taxAmount: Number(i.taxAmount),
      total: Number(i.total),
    })) ?? [],
    payments: o.payments?.map((p: any) => ({
      id: p.id,
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
      reference: p.reference,
      paidAt: p.paidAt,
    })) ?? [],
    statusLogs: o.statusLogs?.map((l: any) => ({
      fromStatus: l.fromStatus,
      toStatus: l.toStatus,
      note: l.note,
      createdAt: l.createdAt,
    })) ?? [],
  };
}

export async function createStoreOrder(input: OrderInput) {
  // Resolve line items: provided directly, or from the session cart.
  let lines = input.items ?? [];
  let sessionCartId: string | null = null;
  if (!lines.length && input.sessionId) {
    const cart = await prisma.cart.findFirst({
      where: { sessionId: input.sessionId },
      include: { items: true },
    });
    if (!cart || cart.status !== "OPEN") throw new HttpError("Cart not found or already checked out", 400);
    sessionCartId = cart.id;
    lines = cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty }));
  }
  if (!lines.length) throw new HttpError("No items to order", 422);

  // Load products and validate availability
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderLines: any[] = [];
  for (const l of lines) {
    const p = productMap.get(l.productId);
    if (!p || p.deletedAt || !p.active) throw new HttpError(`Product ${l.productId} is not available`, 404);
    if (p.stock < l.qty) throw new HttpError(`Insufficient stock for ${p.name}`, 409);
    const price = effectivePrice(p);
    orderLines.push({ ...l, name: p.name, sku: p.sku, unitPrice: price, buyingPrice: Number(p.buyingPrice), categoryId: p.categoryId, taxExempt: p.taxExempt });
  }

  const subtotal = round2(orderLines.reduce((s, l) => s + l.unitPrice * l.qty, 0));

  // Tax
  const taxResult = await computeTax(prisma, orderLines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, unitPrice: l.unitPrice, categoryId: l.categoryId, taxExempt: l.taxExempt })));

  // Coupon
  let discount = 0;
  let coupon: any = null;
  let isFreeShipping = false;
  if (input.couponCode) {
    const res = await validateAndComputeCoupon(input.couponCode, orderLines.map((l) => ({ productId: l.productId, categoryId: l.categoryId, qty: l.qty, unitPrice: l.unitPrice })), subtotal);
    coupon = res.coupon;
    discount = res.discount;
    isFreeShipping = res.isFreeShipping;
  }

  const shippingAmount = isFreeShipping ? 0 : 0; // flat 0 for now; configure via settings later
  const grandTotal = round2(subtotal - discount + taxResult.totalTax + shippingAmount);

  const addressSnapshot = input.address;

  const order = await prisma.$transaction(async (tx) => {
    // Resolve or create customer
    let customerId: string | null = null;
    let customerEmail = input.customer?.email ?? null;
    const customerName = input.customer?.name ?? (input.address.fullName ?? "Guest");
    const customerPhone = input.customer?.phone ?? input.address.phone ?? "";

    if (input.customer?.id) {
      const found = await tx.customer.findUnique({ where: { id: input.customer.id } });
      if (!found) throw new HttpError("Customer not found", 404);
      customerId = found.id;
      customerEmail = found.email;
    } else if (input.customer?.email) {
      const normalized = input.customer.email.toLowerCase().trim();
      const found = await tx.customer.findUnique({ where: { email: normalized } });
      if (found) {
        customerId = found.id;
      } else {
        const created = await tx.customer.create({
          data: { name: customerName, email: normalized, phone: customerPhone || null, passwordHash: null, status: "ACTIVE" },
        });
        customerId = created.id;
      }
    } else if (input.sessionId) {
      // Link order to a guest-created customer snapshot if possible; else stay anonymous
    }

    if (customerId) {
      await tx.customerAddress.create({
        data: {
          customerId,
          label: "Order",
          fullName: addressSnapshot.fullName,
          phone: addressSnapshot.phone,
          line1: addressSnapshot.line1,
          line2: addressSnapshot.line2 ?? null,
          city: addressSnapshot.city,
          state: addressSnapshot.state ?? null,
          postalCode: addressSnapshot.postalCode ?? null,
          country: addressSnapshot.country ?? "Pakistan",
          isDefault: false,
        },
      });
    }

    // Order sequence
    const seqSetting = await tx.storeSetting.upsert({
      where: { key: "order_sequence" },
      create: { key: "order_sequence", value: "1", group: "system" },
      update: {},
    });
    const seq = parseInt(seqSetting.value, 10) || 0;
    const orderNumber = nextOrderNumber(seq + 1);
    await tx.storeSetting.update({ where: { key: "order_sequence" }, data: { value: String(seq + 1) } });

    if (sessionCartId) {
      await tx.cart.update({ where: { id: sessionCartId }, data: { status: "CHECKED_OUT" } });
    }

    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        shippingAddress: JSON.stringify(addressSnapshot),
        subtotal,
        discountAmount: discount,
        couponCode: coupon?.code ?? null,
        taxAmount: taxResult.totalTax,
        shippingAmount,
        grandTotal,
        paymentMethod: input.paymentMethod,
        paymentStatus: "UNPAID",
        orderStatus: "PENDING",
        note: input.note ?? null,
        items: {
          create: orderLines.map((l) => {
            const tl = taxResult.lines.find((x) => x.productId === l.productId);
            return {
              productId: l.productId,
              productName: l.name,
              sku: l.sku,
              unitPrice: l.unitPrice,
              buyingPrice: l.buyingPrice,
              quantity: l.qty,
              discountAmount: 0,
              taxRate: tl?.taxRate ?? 0,
              taxAmount: tl?.taxAmount ?? 0,
              total: l.unitPrice * l.qty,
            };
          }),
        },
        payments: {
          create: [{ method: input.paymentMethod, amount: grandTotal, status: "PENDING" }],
        },
        statusLogs: {
          create: [{ toStatus: "PENDING", note: "Order placed" }],
        },
      },
    });

    // Decrement stock
    for (const l of orderLines) {
      await adjustStock(tx, l.productId, -l.qty, "OUT", `Order ${orderNumber}`, undefined, l.buyingPrice);
    }

    // Coupon usage
    if (coupon) {
      await tx.couponUsage.create({ data: { couponId: coupon.id, customerId, orderId: created.id } });
    }

    // Customer stats
    if (customerId) {
      const cust = await tx.customer.findUnique({ where: { id: customerId } });
      if (cust) {
        await tx.customer.update({
          where: { id: customerId },
          data: { lastOrderAt: new Date(), totalSpent: Number(cust.totalSpent) + grandTotal },
        });
      }
    }

    return created;
  });

  return prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true, payments: true, statusLogs: true, customer: { select: { id: true, name: true, email: true, phone: true } } },
  });
}

export async function updateOrderStatus(orderId: string, orderStatus: string, note: string | undefined, adminId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new HttpError("Order not found", 404);

  const fromStatus = order.orderStatus;

  return prisma.$transaction(async (tx) => {
    const data: any = { orderStatus };
    if (orderStatus === "DELIVERED") data.deliveredAt = new Date();
    if (orderStatus === "CANCELLED" && order.orderStatus !== "CANCELLED") {
      data.cancelledAt = new Date();
      // Restore stock when cancelling a pending/processing/shipped order
      if (!["DELIVERED", "CANCELLED", "REFUNDED", "RETURNED"].includes(order.orderStatus)) {
        for (const item of order.items) {
          if (item.productId) {
            await adjustStock(tx, item.productId, item.quantity, "RELEASE", `Order ${order.orderNumber} cancelled`, adminId);
          }
        }
      }
    }
    if (orderStatus === "REFUNDED") {
      await tx.payment.updateMany({ where: { orderId }, data: { status: "REFUNDED" } });
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "REFUNDED" } });
    }

    await tx.orderStatusLog.create({
      data: { orderId, fromStatus, toStatus: orderStatus, note: note ?? null, adminId: adminId ?? null },
    });
    return tx.order.update({ where: { id: orderId }, data });
  });
}

export async function recordPayment(orderId: string, input: { method?: string; amount?: number; reference?: string; status?: string; paidAt?: string | null }, adminId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError("Order not found", 404);

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        orderId,
        method: input.method ?? order.paymentMethod,
        amount: input.amount ?? Number(order.grandTotal),
        reference: input.reference ?? null,
        status: input.status ?? "PAID",
        paidAt: input.paidAt ? new Date(input.paidAt) : input.status === "PAID" ? new Date() : null,
      },
    });

    // Recompute payment status from the sum of successful payments
    const payments = await tx.payment.findMany({ where: { orderId, status: "PAID" } });
    const paidSum = payments.reduce((s, p) => s + Number(p.amount), 0);
    let paymentStatus = "UNPAID";
    if (paidSum >= Number(order.grandTotal)) paymentStatus = "PAID";
    else if (paidSum > 0) paymentStatus = "PARTIALLY_PAID";
    if (input.status === "REFUNDED") paymentStatus = "REFUNDED";
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });
    return payment;
  });
}