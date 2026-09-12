import { Router } from "express";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { validateBody, validateQuery } from "../../middlewares/validate";
import { cartItemSchema, cartUpdateSchema, cartClearSchema } from "./cart.schema";
import { round2, computeTax } from "../../lib/tax";

const router = Router();

function effectivePrice(p: any) {
  if (p.salePrice && Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.sellingPrice)) {
    return Number(p.salePrice);
  }
  return Number(p.sellingPrice);
}

const include = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          sellingPrice: true,
          salePrice: true,
          stock: true,
          unit: true,
          category: { select: { id: true, name: true } },
          images: { where: { isMain: true }, take: 1, select: { url: true } },
        },
      },
    },
  },
};

async function getOrCreateCart(sessionId?: string, customerId?: string) {
  if (sessionId) {
    const existing = await prisma.cart.findFirst({ where: { sessionId }, include });
    if (existing) return prisma.cart.update({ where: { id: existing.id }, data: { customerId }, include });
    return prisma.cart.create({ data: { sessionId, customerId }, include });
  }
  if (customerId) {
    const existing = await prisma.cart.findFirst({ where: { customerId, status: "OPEN" }, include });
    if (existing) return prisma.cart.update({ where: { id: existing.id }, data: {}, include });
  }
  throw new Error("cart: either sessionId or authenticated customer is required");
}

function serialize(cart: any) {
  const subtotal = round2(cart.items.reduce((s: number, i: any) => s + Number(i.unitPrice) * i.qty, 0));
  const taxAmount = round2(cart.items.reduce((s: number, i: any) => s + Number(i.taxAmount), 0));
  const total = round2(subtotal + taxAmount - 0);
  return {
    id: cart.id,
    sessionId: cart.sessionId,
    customerId: cart.customerId,
    status: cart.status,
    subtotal,
    taxAmount,
    total,
    itemCount: cart.items.reduce((s: number, i: any) => s + i.qty, 0),
    items: cart.items.map((i: any) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
      taxAmount: Number(i.taxAmount),
      total: Number(i.total),
      effectivePrice: effectivePrice(i.product),
      product: {
        id: i.product.id,
        name: i.product.name,
        slug: i.product.slug,
        sku: i.product.sku,
        stock: i.product.stock,
        unit: i.product.unit,
        category: i.product.category,
        image: i.product.images[0]?.url ?? null,
        sellingPrice: Number(i.product.sellingPrice),
        salePrice: i.product.salePrice === null ? null : Number(i.product.salePrice),
        onSale: Number(i.product.salePrice) > 0 && Number(i.product.salePrice) < Number(i.product.sellingPrice),
      },
    })),
  };
}

// GET /api/store/cart?sessionId=abc
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const sessionId = String(req.query.sessionId ?? "").trim() || undefined;
    const cart = await getOrCreateCart(sessionId);
    return ok(res, serialize(cart));
  })
);

// POST /api/store/cart/items
router.post(
  "/items",
  validateBody(cartItemSchema),
  asyncHandler(async (req, res) => {
    const { sessionId, productId, variantId, qty } = req.body;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt || !product.active) return fail(res, "Product not found", 404);
    const cart = await getOrCreateCart(String(sessionId ?? "").trim() || undefined);
    if (cart.status !== "OPEN") return fail(res, "Cart is checked out", 400);

    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId, variantId: variantId ?? null },
    });
    const newQty = (existingItem?.qty ?? 0) + qty;
    if (newQty > product.stock) return fail(res, `Only ${product.stock} units in stock`, 409);

    const unitPrice = effectivePrice(product);
    const taxResult = await computeLineTax(product, unitPrice, newQty);
    const total = round2(unitPrice * newQty + taxResult);

    if (existingItem) {
      await prisma.cartItem.update({ where: { id: existingItem.id }, data: { qty: newQty, unitPrice, taxAmount: taxResult, total } });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, variantId: variantId ?? null, qty, unitPrice, taxAmount: taxResult, total },
      });
    }
    const updated = await prisma.cart.findUnique({ where: { id: cart.id }, include });
    return ok(res, serialize(updated!), "Item added to cart", 201);
  })
);

// PATCH /api/store/cart/items/:itemId
router.patch(
  "/items/:itemId",
  validateBody(cartUpdateSchema),
  asyncHandler(async (req, res) => {
    const item = await prisma.cartItem.findUnique({ where: { id: req.params.itemId }, include: { product: true, cart: true } });
    if (!item) return fail(res, "Cart item not found", 404);
    if (item.cart.status !== "OPEN") return fail(res, "Cart is checked out", 400);
    if (req.body.qty > item.product.stock) return fail(res, `Only ${item.product.stock} units in stock`, 409);

    const unitPrice = effectivePrice(item.product);
    const taxResult = await computeLineTax(item.product, unitPrice, req.body.qty);
    const total = round2(unitPrice * req.body.qty + taxResult);
    const updated = await prisma.cartItem.update({
      where: { id: item.id },
      data: { qty: req.body.qty, unitPrice, taxAmount: taxResult, total },
    });
    const cart = await prisma.cart.findUnique({ where: { id: item.cartId }, include });
    return ok(res, serialize(cart!));
  })
);

// DELETE /api/store/cart/items/:itemId
router.delete(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const item = await prisma.cartItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return fail(res, "Cart item not found", 404);
    await prisma.cartItem.delete({ where: { id: item.id } });
    const cart = await prisma.cart.findUnique({ where: { id: item.cartId }, include });
    return ok(res, serialize(cart!), "Item removed");
  })
);

// DELETE /api/store/cart/clear?sessionId=abc
router.delete(
  "/clear",
  validateQuery(cartClearSchema),
  asyncHandler(async (req, res) => {
    const sessionId = String(req.query.sessionId ?? "").trim();
    if (!sessionId) return fail(res, "sessionId is required", 422);
    const cart = await prisma.cart.findFirst({ where: { sessionId } });
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return ok(res, null, "Cart cleared");
  })
);

async function computeLineTax(product: any, unitPrice: number, qty: number): Promise<number> {
  const result = await computeTax(prisma, [
    { productId: product.id, name: product.name, qty, unitPrice, categoryId: product.categoryId, taxExempt: product.taxExempt },
  ]);
  return result.totalTax;
}

export default router;