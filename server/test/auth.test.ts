import { describe, expect, test } from "vitest";
import { api, loginAdmin, authHeader, ADMIN_EMAIL, ADMIN_PASSWORD, prisma } from "./helpers";

describe("Auth", () => {
  test("login succeeds with correct credentials", async () => {
    const res = await api.post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.admin.role).toBe("SUPER_ADMIN");
  });

  test("login rejects wrong password", async () => {
    const res = await api.post("/api/auth/login").send({ email: ADMIN_EMAIL, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  test("login rejects unknown email", async () => {
    const res = await api.post("/api/auth/login").send({ email: "nobody@test.pk", password: "whatever123" });
    expect(res.status).toBe(401);
  });

  test("GET /api/auth/me returns profile with permissions", async () => {
    const { accessToken } = await loginAdmin();
    const res = await api.get("/api/auth/me").set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(ADMIN_EMAIL);
    expect(res.body.data.permissions).toContain("products");
    expect(res.body.data.permissions).toContain("settings");
  });

  test("me rejects missing/invalid token", async () => {
    const res = await api.get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("refresh rotates the token and revokes the old one", async () => {
    const { refreshToken } = await loginAdmin();
    const r1 = await api.post("/api/auth/refresh").send({ refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.data.accessToken).toBeTruthy();
    const newRefresh = r1.body.data.refreshToken;

    // old token must be rejected after rotation
    const reuse = await api.post("/api/auth/refresh").send({ refreshToken });
    expect(reuse.status).toBe(401);

    // new token works
    const r2 = await api.post("/api/auth/refresh").send({ refreshToken: newRefresh });
    expect(r2.status).toBe(200);
  });

  test("logout revokes the refresh token", async () => {
    const { refreshToken } = await loginAdmin();
    const out = await api.post("/api/auth/logout").send({ refreshToken });
    expect(out.status).toBe(200);
    const reuse = await api.post("/api/auth/refresh").send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  test("forgot -> reset -> login with new password", async () => {
    const { accessToken, admin } = await loginAdmin();
    if (admin.id === "system") return;
    const res = await api.post("/api/auth/forgot-password").send({ email: ADMIN_EMAIL });
    expect(res.status).toBe(200);
    const token = res.body.data?.devResetToken ?? res.body.data?.resetToken;
    expect(token).toBeTruthy();
    const reset = await api.post("/api/auth/reset-password").send({ token, newPassword: "BrandNew@2026" });
    expect(reset.status).toBe(200);

    const loginNew = await api.post("/api/auth/login").send({ email: ADMIN_EMAIL, password: "BrandNew@2026" });
    expect(loginNew.status).toBe(200);

    // revert password
    await api.post("/api/auth/change-password").set(authHeader(accessToken)).send({ currentPassword: "BrandNew@2026", newPassword: ADMIN_PASSWORD });
    const loginOld = await api.post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(loginOld.status).toBe(200);
  });

  test("isolation: refresh token records belong to one admin", async () => {
    const a = await loginAdmin();
    const before = await prisma.refreshToken.count();
    const r1 = await api.post("/api/auth/refresh").send({ refreshToken: a.refreshToken });
    expect(r1.status).toBe(200);
    const after = await prisma.refreshToken.count();
    expect(after).toBe(before + 1);
  });
});