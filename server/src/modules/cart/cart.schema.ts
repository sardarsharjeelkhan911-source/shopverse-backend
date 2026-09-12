import { z } from "zod";

export const cartItemSchema = z
  .object({
    sessionId: z.string().min(1).max(100).optional(),
    productId: z.string().cuid("Valid product id required"),
    variantId: z.string().cuid().optional().nullable(),
    qty: z.coerce.number().int().min(1).max(999).default(1),
  })
  .strict();

export const cartUpdateSchema = z
  .object({
    qty: z.coerce.number().int().min(1).max(999),
  })
  .strict();

export const cartClearSchema = z
  .object({
    sessionId: z.string().min(1).max(100).optional(),
  })
  .strict();