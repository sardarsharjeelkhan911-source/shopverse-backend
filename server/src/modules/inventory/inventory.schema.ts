import { z } from "zod";

export const inventoryMovementQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    productId: z.string().cuid().optional(),
    type: z.enum(["IN", "OUT", "ADJUST", "RESERVE", "RELEASE", "COST", "REFUND"]).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();

export const stockAdjustSchema = z
  .object({
    productId: z.string().cuid("Valid product id required"),
    type: z.enum(["IN", "OUT", "ADJUST"]).default("ADJUST"),
    quantity: z.coerce.number().int("Quantity must be an integer").min(0),
    reason: z.string().min(2, "Reason is required").max(255),
    cost: z.coerce.number().min(0).optional().nullable(),
  })
  .strict();