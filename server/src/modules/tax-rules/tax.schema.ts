import { z } from "zod";

export const taxRuleSchema = z
  .object({
    name: z.string().min(2, "Name is required").max(120),
    type: z.enum(["PERCENT", "FIXED"]).default("PERCENT"),
    rate: z.coerce.number().min(0).max(100).default(0),
    fixedAmount: z.coerce.number().min(0).optional().nullable(),
    appliesTo: z.enum(["ALL", "CATEGORY", "PRODUCT"]).default("ALL"),
    categoryId: z.string().cuid().optional().nullable(),
    productId: z.string().cuid().optional().nullable(),
    isInclusive: z.boolean().default(false),
    rounding: z.enum(["ROUND_HALF_UP", "ROUND_UP", "ROUND_DOWN", "NONE"]).default("ROUND_HALF_UP"),
    active: z.boolean().default(true),
  })
  .strict();

export const taxRuleQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional().default(""),
  })
  .strict();