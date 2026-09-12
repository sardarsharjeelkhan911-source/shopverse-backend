import { z } from "zod";

export const categorySchema = z
  .object({
    name: z.string().min(2, "Name is required").max(120),
    slug: z.string().min(2).max(120).optional(),
    description: z.string().max(500).optional().nullable(),
    image: z.string().url("Image must be a valid URL").optional().nullable(),
    parentId: z.string().cuid().optional().nullable(),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .strict();

export const categoryQuery = z
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