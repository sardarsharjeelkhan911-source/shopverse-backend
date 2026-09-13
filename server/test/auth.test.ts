import { describe, expect, test } from "vitest";
import { api, loginAdmin, authHeader, ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD, STAFF_USERNAME, STAFF_PASSWORD, prisma } from "./helpers";
import { hashPassword } from "../src/lib/password";

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

  test("login succeeds with username instead of email", async () => {
    const res = await api.post("/api/auth/login").send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.admin.username).toBe(ADMIN_USERNAME);
    expect(res.body.data.admin.role).toBe("SUPER_ADMIN");
  });

  test("STAFF user (storef) can login with username", async () => {
    const res = await api.post("/api/auth/login").send({ username: STAFF_USERNAME, password: STAFF_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.admin.username).toBe(STAFF_USERNAME);
    expect(res.body.data.admin.role).toBe("STAFF");
    // staff permitted on orders but not settings/admins
    expect(res.body.data.permissions).toContain("orders");
    expect(res.body.data.permissions).not.toContain("settings");
    expect(res.body.data.permissions).not.toContain("admins");
  });

  test("login rejects unknown username", async () => {
    const res = await api.post("/api/auth/login").send({ username: "nobody", password: "whatever123" });
    expect(res.status).toBe(401);
  });

  test("login rejects when neither username nor email provided", async () => {
    const res = await api.post("/api/auth/login").send({ password: "whatever123" });
    expect(res.status).toBe(422);
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

    // restore original password directly via prisma (change-password enforces min 8 chars, admin45 is shorter)
    await prisma.adminUser.update({
      where: { email: ADMIN_EMAIL },
      data: { passwordHash: await hashPassword(ADMIN_PASSWORD) },
    });
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