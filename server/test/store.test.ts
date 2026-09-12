import { describe, expect, test } from "vitest";
import { api } from "./helpers";

describe("Public store API", () => {
  test("GET /api/store/products returns paginated catalog", async () => {
    const res = await api.get("/api/store/products?pageSize=5&page=1");
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.total).toBeGreaterThan(0);
    const p = res.body.data.items[0];
    expect(p.id).toBeTruthy();
    expect(p.name).toBeTruthy();
    expect(p.sellingPrice).toBeTypeOf("number");
    expect(p.active).toBe(true);
  });

  test("product search works", async () => {
    const all = await api.get("/api/store/products?pageSize=100");
    const target = all.body.data.items[0];
    const res = await api.get(`/api/store/products?pageSize=20&search=${encodeURIComponent(target.name.slice(0, 6))}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  test("product detail by slug", async () => {
    const all = await api.get("/api/store/products?pageSize=1");
    const slug = all.body.data.items[0].slug;
    const res = await api.get(`/api/store/products/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(slug);
  });

  test("unknown product slug returns 404", async () => {
    const res = await api.get("/api/store/products/does-not-exist-xyz");
    expect(res.status).toBe(404);
  });

  test("GET /api/store/categories", async () => {
    const res = await api.get("/api/store/categories");
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  test("GET /api/store/brands", async () => {
    const res = await api.get("/api/store/brands");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  test("GET /api/store/settings exposes public keys", async () => {
    const res = await api.get("/api/store/settings");
    expect(res.status).toBe(200);
    expect(res.body.data.store_name).toBeTruthy();
    expect(typeof res.body.data.support_phone).toBe("string");
  });
});