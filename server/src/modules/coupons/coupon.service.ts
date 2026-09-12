import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error";
import { round2 } from "../../lib/tax";

export type DiscountLine = { productId: string; qty: number; unitPrice: number; categoryId?: string | null };

/**
 * Validate a coupon code and compute the discount for a set of line items.
 * Throws HttpError when the coupon is invalid or not applicable.
 */
export async function validateAndComputeCoupon(code: string, items: DiscountLine[], subtotal: number, customerId?: string | null) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon || !coupon.active) throw new HttpError("Invalid or inactive coupon", 404);

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new HttpError("Coupon is not active yet", 400);
  if (coupon.expiresAt && coupon.expiresAt < now) throw new HttpError("Coupon has expired", 400);

  if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
    throw new HttpError(`Minimum order amount of ₨${Number(coupon.minOrderAmount).toLocaleString()} required`, 400);
  }

  const used = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
  if (coupon.usageLimit && coupon.usageLimit > 0 && used >= coupon.usageLimit) {
    throw new HttpError("Coupon usage limit reached", 400);
  }

  if (customerId) {
    const perCustomer = await prisma.couponUsage.count({ where: { couponId: coupon.id, customerId } });
    if (coupon.perCustomerLimit && coupon.perCustomerLimit > 0 && perCustomer >= coupon.perCustomerLimit) {
      throw new HttpError("You have already used this coupon", 400);
    }
  }

  // Eligibility of line items
  let applicableSubtotal = 0;
  let applies = false;
  const scoped = coupon.productId || coupon.categoryId;
  for (const it of items) {
    const matches =
      coupon.productId === it.productId ||
      (coupon.categoryId && coupon.categoryId === it.categoryId) ||
      coupon.type === "FREE_SHIPPING";
    if (scoped && !matches) continue;
    applicableSubtotal += it.qty * it.unitPrice;
    applies = true;
  }
  if (!applies) throw new HttpError("Coupon does not apply to the items in this cart", 400);

  let discount = 0;
  if (coupon.type === "PERCENT") {
    discount = (applicableSubtotal * Number(coupon.value)) / 100;
  } else if (coupon.type === "FIXED") {
    discount = Math.min(Number(coupon.value), applicableSubtotal);
  }
  if (coupon.maxDiscount && Number(coupon.maxDiscount) > 0) discount = Math.min(discount, Number(coupon.maxDiscount));
  discount = round2(discount);

  return { coupon, discount, applicableSubtotal, isFreeShipping: coupon.type === "FREE_SHIPPING" };
}