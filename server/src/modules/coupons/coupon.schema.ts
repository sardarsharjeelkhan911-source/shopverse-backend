import { z } from "zod";

export const couponSchema = z
  .object({
    code: z.string().min(3, "Code must be at least 3 characters").max(40).transform((v) => v.trim().toUpperCase()),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]).default("PERCENT"),
    value: z.coerce.number().min(0, "Discount value is required"),
    minOrderAmount: z.coerce.number().min(0).optional().nullable(),
    maxDiscount: z.coerce.number().min(0).optional().nullable(),
    startsAt: z.string().datetime().optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
    usageLimit: z.coerce.number().int().min(0).optional().nullable(),
    perCustomerLimit: z.coerce.number().int().min(0).optional().nullable(),
    productId: z.string().cuid().optional().nullable(),
    categoryId: z.string().cuid().optional().nullable(),
    active: z.boolean().default(true),
  })
  .strict();

export const couponQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional().default(""),
    active: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  })
  .strict();