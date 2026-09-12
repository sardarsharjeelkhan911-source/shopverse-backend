import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error";
import { slugify, toNumber } from "../../utils/helpers";
import { audit } from "../audit/audit";
import type { z } from "zod";
import type { productSchema } from "./product.schema";

type ProductInput = z.infer<typeof productSchema>;

export const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
  variants: true,
};

export function serializeProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    shortDescription: p.shortDescription,
    sku: p.sku,
    barcode: p.barcode,
    buyingPrice: toNumber(p.buyingPrice),
    sellingPrice: toNumber(p.sellingPrice),
    salePrice: p.salePrice === null ? null : toNumber(p.salePrice),
    stock: p.stock,
    minStock: p.minStock,
    unit: p.unit,
    weight: p.weight === null ? null : toNumber(p.weight),
    dimensions: p.dimensions,
    tags: p.tags,
    featured: p.featured,
    active: p.active,
    taxExempt: p.taxExempt,
    categoryId: p.categoryId,
    category: p.category,
    brandId: p.brandId,
    brand: p.brand,
    images: p.images ?? [],
    variants: p.variants ?? [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function createProduct(input: ProductInput, adminId?: string): Promise<any> {
  const slug = input.slug || slugify(input.name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) throw new HttpError("Product slug already exists", 409);

  const skuDup = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (skuDup) throw new HttpError("SKU must be unique", 409);

  if (input.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!cat) throw new HttpError("Category does not exist", 422);
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        shortDescription: input.shortDescription ?? null,
        sku: input.sku,
        barcode: input.barcode ?? null,
        buyingPrice: input.buyingPrice,
        sellingPrice: input.sellingPrice,
        salePrice: input.salePrice ?? null,
        stock: input.stock,
        minStock: input.minStock,
        unit: input.unit,
        weight: input.weight ?? null,
        dimensions: input.dimensions ?? null,
        tags: input.tags ?? null,
        featured: input.featured,
        active: input.active,
        taxExempt: input.taxExempt,
        categoryId: input.categoryId ?? null,
        brandId: input.brandId ?? null,
        createdById: adminId ?? null,
        updatedById: adminId ?? null,
        images: input.imageUrls.length
          ? {
              create: input.imageUrls.map((url, i) => ({
                url,
                isMain: i === input.mainImageIndex,
                sortOrder: i,
              })),
            }
          : undefined,
        variants: input.variants.length
          ? {
              create: input.variants.map((v) => ({
                name: v.name,
                value: v.value,
                sku: v.sku ?? null,
                priceDelta: v.priceDelta,
                stock: v.stock,
              })),
            }
          : undefined,
      },
      include: productInclude,
    });

    if (input.stock > 0) {
      await tx.inventoryMovement.create({
        data: {
          productId: created.id,
          type: "IN",
          quantity: input.stock,
          stockBefore: 0,
          stockAfter: input.stock,
          cost: input.buyingPrice,
          reason: "Initial stock on create",
          createdById: adminId ?? null,
        },
      });
    }
    return created;
  });

  await audit(adminId, "CREATE", "Product", product.id, `Created product ${product.name}`);
  return product;
}

export async function updateProduct(id: string, input: Partial<ProductInput>, adminId?: string): Promise<any> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new HttpError("Product not found", 404);

  const data: any = {};
  for (const [k, v] of Object.entries(input)) {
    if (["imageUrls", "mainImageIndex", "variants"].includes(k)) continue;
    data[k] = v;
  }
  if (input.name && !input.slug) data.slug = slugify(input.name);
  if (input.sku && input.sku !== existing.sku) {
    const skuDup = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (skuDup) throw new HttpError("SKU must be unique", 409);
  }

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: {
        ...data,
        updatedById: adminId ?? null,
        images: input.imageUrls
          ? {
              deleteMany: {},
              create: input.imageUrls.length
                ? input.imageUrls.map((url, i) => ({
                    url,
                    isMain: i === (input.mainImageIndex ?? 0),
                    sortOrder: i,
                  }))
                : [],
            }
          : undefined,
        variants: input.variants
          ? {
              deleteMany: {},
              create: input.variants.length ? input.variants.map((v) => ({ ...v })) : [],
            }
          : undefined,
      },
      include: productInclude,
    });
    return updated;
  });

  await audit(adminId, "UPDATE", "Product", product.id, `Updated product ${product.name}`);
  return product;
}

/** Soft delete products that are not referenced by completed orders. */
export async function deleteProduct(id: string, adminId?: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { orderItems: { where: { order: { orderStatus: { notIn: ["CANCELLED"] } } }, select: { id: true } } },
  });
  if (!product) throw new HttpError("Product not found", 404);
  if (product.orderItems.length > 0) {
    throw new HttpError("Product is referenced by completed orders and cannot be deleted.", 409);
  }
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  await audit(adminId, "DELETE", "Product", id, `Deleted product ${product.name}`);
}

/** Adjust stock through the inventory module (shared helper). */
export async function adjustStock(
  tx: any,
  productId: string,
  delta: number,
  type: string,
  reason: string,
  adminId?: string,
  cost?: number
) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new HttpError("Product not found", 404);
  const next = product.stock + delta;
  if (next < 0) throw new HttpError(`Insufficient stock for ${product.name}`, 409);
  await tx.product.update({ where: { id: productId }, data: { stock: next } });
  await tx.inventoryMovement.create({
    data: {
      productId,
      type,
      quantity: delta,
      stockBefore: product.stock,
      stockAfter: next,
      reason,
      cost: cost ?? null,
      createdById: adminId ?? null,
    },
  });
  return next;
}