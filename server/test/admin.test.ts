import { describe, expect, test } from "vitest";
import { api, loginAdmin, ensureAdmin, authHeader, unique } from "./helpers";

describe("Admin catalog + RBAC", () => {
  test("unauthenticated admin requests are rejected", async () => {
    const res = await api.get("/api/admin/products");
    expect(res.status).toBe(401);
  });

  test("super admin can create/update/delete a category", async () => {
    const { accessToken } = await loginAdmin();

    const created = await api.post("/api/admin/categories").set(authHeader(accessToken)).send({
      name: unique("Cat"),
      description: "test category",
      active: true,
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const updated = await api.put(`/api/admin/categories/${id}`).set(authHeader(accessToken)).send({ active: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.active).toBe(false);

    const removed = await api.delete(`/api/admin/categories/${id}`).set(authHeader(accessToken));
    expect(removed.status).toBe(200);

    const listing = await api.get(`/api/admin/categories`).set(authHeader(accessToken));
    const ids = listing.body.data.items.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(id);
  });

  test("duplicate category slug is rejected", async () => {
    const { accessToken } = await loginAdmin();
    const list = await api.get("/api/admin/categories").set(authHeader(accessToken));
    const existing = list.body.data.items[0];
    const res = await api.post("/api/admin/categories").set(authHeader(accessToken)).send({ name: existing.name });
    expect(res.status).toBe(409);
  });

  test("super admin can create and soft-delete a product", async () => {
    const { accessToken } = await loginAdmin();

    const category = await api.post("/api/admin/categories").set(authHeader(accessToken)).send({ name: unique("CatP") });
    const product = await api.post("/api/admin/products").set(authHeader(accessToken)).send({
      name: unique("Widget"),
      sku: unique("SKU"),
      sellingPrice: 99,
      buyingPrice: 50,
      stock: 5,
      categoryId: category.body.data.id,
      active: true,
    });
    expect(product.status).toBe(201);
    expect(product.body.data.stock).toBe(5);

    const updated = await api.put(`/api/admin/products/${product.body.data.id}`).set(authHeader(accessToken)).send({ sellingPrice: 129 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.sellingPrice).toBe(129);

    const removed = await api.delete(`/api/admin/products/${product.body.data.id}`).set(authHeader(accessToken));
    expect(removed.status).toBe(200);

    const detail = await api.get(`/api/store/products/${product.body.data.slug}`);
    expect(detail.status).toBe(404); // soft-deleted products are hidden from the store
  });

  test("duplicate SKU is rejected", async () => {
    const { accessToken } = await loginAdmin();
    const list = await api.get("/api/admin/products").set(authHeader(accessToken));
    const existing = list.body.data.items[0];
    const res = await api.post("/api/admin/products").set(authHeader(accessToken)).send({
      name: unique("Dup"),
      sku: existing.sku,
      sellingPrice: 1,
    });
    expect(res.status).toBe(409);
  });

  test("STAFF can read products but cannot touch settings", async () => {
    const staff = await ensureAdmin("staff.test@shopverse.pk", "STAFF");

    const products = await api.get("/api/admin/products").set(authHeader(staff.accessToken));
    expect(products.status).toBe(200);

    const settingsGet = await api.get("/api/admin/settings").set(authHeader(staff.accessToken));
    expect(settingsGet.status).toBe(403);

    const settingsPut = await api.put("/api/admin/settings").set(authHeader(staff.accessToken)).send({
      settings: [{ key: "store_name", value: "Hacked", group: "general" }],
    });
    expect(settingsPut.status).toBe(403);
  });

  test("STAFF cannot access reports or admins", async () => {
    const staff = await ensureAdmin("staff.test@shopverse.pk", "STAFF");
    const reports = await api.get("/api/admin/reports/summary").set(authHeader(staff.accessToken));
    expect(reports.status).toBe(403);
    const admins = await api.get("/api/admin/admins").set(authHeader(staff.accessToken));
    expect(admins.status).toBe(403);
  });

  test("MANAGER granted wider access", async () => {
    const manager = await ensureAdmin("manager.test@shopverse.pk", "MANAGER");
    expect(manager.permissions).toContain("products");
    expect(manager.permissions).toContain("orders");
    expect(manager.permissions).toContain("reports");
    expect(manager.permissions).not.toContain("admins");
    expect(manager.permissions).not.toContain("settings");
  });

  test("super admin can create admin users", async () => {
    const { accessToken } = await loginAdmin();
    const roles = await api.get("/api/admin/admins/roles").set(authHeader(accessToken));
    const staffRole = roles.body.data.items.find((r: { name: string }) => r.name === "STAFF");
    const created = await api.post("/api/admin/admins").set(authHeader(accessToken)).send({
      name: unique("Temp"),
      email: unique("tmp") + "@test.pk",
      password: "Password@123",
      roleId: staffRole.id,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.role.name).toBe("STAFF");
  });
});