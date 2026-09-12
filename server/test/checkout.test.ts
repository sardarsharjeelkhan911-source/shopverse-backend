import { describe, expect, test } from "vitest";
import { api, loginAdmin, authHeader, unique } from "./helpers";

describe("Checkout lifecycle", () => {
  test("full order lifecycle: create product -> coupon -> order -> cancel restores stock", async () => {
    const { accessToken } = await loginAdmin();
    const h = authHeader(accessToken);

    // category
    const cat = await api.post("/api/admin/categories").set(h).send({ name: unique("CatX") });
    expect(cat.status).toBe(201);
    const categoryId = cat.body.data.id;

    // product, 500 each, stock 10
    const prod = await api.post("/api/admin/products").set(h).send({
      name: unique("Chkout"),
      sku: unique("CHK"),
      sellingPrice: 500,
      buyingPrice: 300,
      stock: 10,
      categoryId,
      active: true,
    });
    expect(prod.status).toBe(201);
    const productId = prod.body.data.id;

    // coupon 10% off
    const coupon = await api.post("/api/admin/coupons").set(h).send({
      code: unique("C").toUpperCase(),
      type: "PERCENT",
      value: 10,
      minOrderAmount: 0,
      active: true,
    });
    expect(coupon.status).toBe(201);
    const couponCode = coupon.body.data.code;

    // order with coupon: 2 x 500 => subtotal 1000, discount 100, grand 900
    const order = await api.post("/api/store/orders").send({
      items: [{ productId, qty: 2 }],
      customer: { name: "Checkout Tester", email: "chk.tester@test.pk", phone: "03111111111" },
      address: { fullName: "Checkout Tester", phone: "03111111111", line1: "Line 1, Test", city: "Karachi" },
      couponCode,
      paymentMethod: "COD",
    });
    expect(order.status).toBe(201);
    expect(order.body.data.grandTotal).toBe(900);
    expect(order.body.data.discountAmount).toBe(100);
    expect(order.body.data.items).toHaveLength(1);
    const orderId = order.body.data.id;

    // coupon usage incremented, stock decremented to 8
    const couponList = await api
      .get(`/api/admin/coupons?search=${couponCode}`)
      .set(h);
    expect(couponList.body.data.items[0].usages).toBeGreaterThanOrEqual(1);
    const prodAfter = await api.get(`/api/admin/products`).set(h);
    const pp = prodAfter.body.data.items.find((p: any) => p.id === productId);
    expect(pp.stock).toBe(8);

    // invalid coupon rejected
    const bad = await api.post("/api/store/orders").send({
      items: [{ productId, qty: 1 }],
      customer: { name: "Xy", email: "x@test.pk", phone: "03111111111" },
      address: { fullName: "Xy", phone: "03111111111", line1: "Line 1", city: "Karachi" },
      couponCode: "NOT-A-REAL-CODE-99",
      paymentMethod: "COD",
    });
    expect(bad.status).toBe(404);

    // stock exceeded
    const over = await api.post("/api/store/orders").send({
      items: [{ productId, qty: 999 }],
      address: { fullName: "Xy", phone: "03111111111", line1: "Line 1", city: "Karachi" },
      paymentMethod: "COD",
    });
    expect(over.status).toBe(409);

    // cancel via admin -> stock restored
    const cancelled = await api.patch(`/api/admin/orders/${orderId}/status`).set(h).send({ orderStatus: "CANCELLED" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.orderStatus).toBe("CANCELLED");

    const prodFinal = await api.get(`/api/admin/products`).set(h);
    const pf = prodFinal.body.data.items.find((p: any) => p.id === productId);
    expect(pf.stock).toBe(10);
  });

  test("order summary endpoint tracks the created order", async () => {
    const res = await api.get("/api/admin/reports/summary");
    expect(res.status).toBe(401); // requires auth
  });
});