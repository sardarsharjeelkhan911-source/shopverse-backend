import { z } from "zod";
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from "../../lib/prisma";

export const addressSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    phone: z.string().min(7).max(20),
    line1: z.string().min(2).max(200),
    line2: z.string().max(200).optional().nullable(),
    city: z.string().min(2).max(80),
    state: z.string().max(80).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
    country: z.string().max(60).optional().default("Pakistan"),
  })
  .strict();

export const orderCreateSchema = z
  .object({
    sessionId: z.string().min(1).max(100).optional(),
    customer: z
      .object({
        id: z.string().cuid().optional(),
        name: z.string().min(2).max(120),
        email: z.string().email(),
        phone: z.string().max(20).optional().nullable(),
      })
      .optional(),
    address: addressSchema,
    items: z
      .array(
        z
          .object({
            productId: z.string().cuid(),
            variantId: z.string().cuid().optional().nullable(),
            qty: z.coerce.number().int().min(1).max(999),
          })
          .strict()
      )
      .min(1)
      .optional(),
    couponCode: z.string().max(40).optional(),
    paymentMethod: z.enum([...PAYMENT_METHODS]).default("COD"),
    note: z.string().max(500).optional(),
  })
  .strict();

export const orderQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional().default(""),
    orderStatus: z.enum([...ORDER_STATUSES]).optional(),
    paymentStatus: z.enum([...PAYMENT_STATUSES]).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();

export const orderStatusSchema = z
  .object({
    orderStatus: z.enum([...ORDER_STATUSES]),
    note: z.string().max(255).optional(),
  })
  .strict();

export const paymentUpdateSchema = z
  .object({
    method: z.enum([...PAYMENT_METHODS]).optional(),
    amount: z.coerce.number().min(0).optional(),
    reference: z.string().max(120).optional(),
    status: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
    paidAt: z.string().datetime().optional().nullable(),
  })
  .strict();