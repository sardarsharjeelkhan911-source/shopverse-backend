import { z } from "zod";
import { UNITS } from "../../lib/prisma";

export const productSchema = z
  .object({
    name: z.string().min(2, "Product name is required").max(200),
    slug: z.string().min(2).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    shortDescription: z.string().max(300).optional().nullable(),
    sku: z.string().min(2, "SKU is required").max(60),
    barcode: z.string().max(60).optional().nullable(),
    buyingPrice: z.coerce.number().min(0, "Buying price cannot be negative").default(0),
    sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),
    salePrice: z.coerce.number().min(0).optional().nullable(),
    stock: z.coerce.number().int().min(0, "Stock cannot be negative").default(0),
    minStock: z.coerce.number().int().min(0).default(5),
    unit: z.enum([...UNITS], { message: "Invalid unit" }).default("piece"),
    weight: z.coerce.number().min(0).optional().nullable(),
    dimensions: z.string().max(100).optional().nullable(),
    tags: z.string().max(255).optional().nullable(),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    taxExempt: z.boolean().default(false),
    categoryId: z.string().cuid().optional().nullable(),
    brandId: z.string().cuid().optional().nullable(),
    imageUrls: z.array(z.string().url()).max(10).optional().default([]),
    mainImageIndex: z.coerce.number().int().min(0).default(0),
    variants: z
      .array(
        z
          .object({
            name: z.string().min(1).max(40),
            value: z.string().min(1).max(40),
            sku: z.string().max(60).optional().nullable(),
            priceDelta: z.coerce.number().default(0),
            stock: z.coerce.number().int().min(0).default(0),
          })
          .strict()
      )
      .optional()
      .default([]),
  })
  .strict();

export const productQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional().default(""),
    categoryId: z.string().cuid().optional(),
    brandId: z.string().cuid().optional(),
    featured: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sortBy: z.enum(["createdAt", "name", "sellingPrice", "stock"]).optional().default("createdAt"),
    sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  })
  .strict();