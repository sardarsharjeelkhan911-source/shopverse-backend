import { z } from "zod";

export const brandSchema = z
  .object({
    name: z.string().min(2, "Name is required").max(120),
    slug: z.string().min(2).max(120).optional(),
    logo: z.string().url("Logo must be a valid URL").optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    active: z.boolean().default(true),
  })
  .strict();

export const brandQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional().default(""),
  })
  .strict();