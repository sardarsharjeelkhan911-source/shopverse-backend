import { Router } from "express";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { authenticate, AuthedRequest } from "../../middlewares/auth";
import { loginLimiter } from "../../middlewares/error";
import { validateBody } from "../../middlewares/validate";
import { loginSchema, refreshSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schema";
import * as authService from "./auth.service";
import { prisma } from "../../lib/prisma";
import { audit } from "../audit/audit";

const router = Router();

router.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const ip = req.ip;
    const result = await authService.login(req.body.email, req.body.password, ip);
    return ok(res, result, "Login successful");
  })
);

router.post(
  "/refresh",
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken, req.ip);
    return ok(res, result, "Token refreshed");
  })
);

router.post(
  "/logout",
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    await authService.logout(req.body.refreshToken);
    return ok(res, null, "Logged out");
  })
);

router.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const token = await authService.forgotPassword(req.body.email);
    // In development print the reset link. Production should send an email.
    if (token) {
      console.log(`[dev] Password reset token: ${token}`);
      return ok(res, { devResetToken: token }, "If that email exists, a reset link was created");
    }
    return ok(res, null, "If that email exists, a reset link was created");
  })
);

router.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const email = await authService.resetPassword(req.body.token, req.body.newPassword);
    return ok(res, { email }, "Password reset successfully");
  })
);

// --- Protected ---
router.use(authenticate);

router.get(
  "/me",
  asyncHandler(async (req: AuthedRequest, res) => {
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.admin!.id },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    if (!admin) return fail(res, "Admin not found", 404);
    return ok(res, {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role.name,
      permissions: admin.role.rolePermissions.map((rp) => rp.permission.key),
    });
  })
);

router.post(
  "/change-password",
  validateBody(changePasswordSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    await authService.changePassword(req.admin!.id, req.body.currentPassword, req.body.newPassword);
    return ok(res, null, "Password changed. Please login again.");
  })
);

router.post(
  "/logout-all",
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.refreshToken.updateMany({ where: { adminId: req.admin!.id }, data: { revokedAt: new Date() } });
    await audit(req.admin!.id, "LOGOUT", "AdminUser", req.admin!.id, "Logged out everywhere");
    return ok(res, null, "Logged out from all devices");
  })
);

export default router;