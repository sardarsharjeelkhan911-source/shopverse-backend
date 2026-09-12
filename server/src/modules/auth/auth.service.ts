import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { signAccessToken } from "../../lib/jwt";
import { HttpError } from "../../middlewares/error";
import { audit } from "../audit/audit";

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export async function login(email: string, password: string, ip?: string) {
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  if (!admin || !admin.active) {
    throw new HttpError("Invalid email or password", 401);
  }
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    throw new HttpError("Invalid email or password", 401);
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  const refreshToken = randomToken();
  await prisma.refreshToken.create({
    data: {
      adminId: admin.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    },
  });

  await audit(admin.id, "LOGIN", "AdminUser", admin.id, `Login from ${ip ?? "unknown"}`, ip);

  return {
    accessToken: signAccessToken({
      sub: admin.id,
      email: admin.email,
      role: admin.role.name,
      version: 1,
    }),
    refreshToken,
    admin: publicProfile(admin.id, admin.name, admin.email, admin.role.name),
    permissions: admin.role.rolePermissions.map((rp) => rp.permission.key),
  };
}

export async function refresh(refreshToken: string, ip?: string) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { admin: { include: { role: true } } },
  });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new HttpError("Invalid or expired refresh token", 401);
  }
  // Opaque tokens are validated by DB lookup (unique hash) + expiry + revoke state.
  // No JWT check needed.

  // rotate
  const newToken = randomToken();
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({
      data: {
        adminId: stored.adminId,
        tokenHash: hashToken(newToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      },
    }),
  ]);

  const permissions = await resolvePermissions(stored.adminId);
  return {
    accessToken: signAccessToken({
      sub: stored.adminId,
      email: stored.admin.email,
      role: stored.admin.role.name,
      version: 1,
    }),
    refreshToken: newToken,
    admin: publicProfile(stored.adminId, stored.admin.name, stored.admin.email, stored.admin.role.name),
    permissions,
  };
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });
}

/** Revoke every refresh token for an admin (used after password change/reset). */
async function revokeAllTokens(adminId: string) {
  await prisma.refreshToken.updateMany({ where: { adminId }, data: { revokedAt: new Date() } });
}

export async function changePassword(adminId: string, currentPassword: string, newPassword: string) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw new HttpError("Admin not found", 404);
  const valid = await verifyPassword(currentPassword, admin.passwordHash);
  if (!valid) throw new HttpError("Current password is incorrect", 401);
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await revokeAllTokens(adminId);
  await audit(adminId, "UPDATE", "AdminUser", adminId, "Changed own password");
}

export async function forgotPassword(email: string) {
  const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Always respond the same, even when the user does not exist (prevent user enumeration).
  if (!admin) return null;
  const token = randomToken();
  await prisma.passwordResetToken.create({
    data: {
      adminId: admin.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });
  return token;
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { admin: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new HttpError("Invalid or expired reset token", 400);
  }
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.adminUser.update({
      where: { id: record.adminId },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
  ]);
  await revokeAllTokens(record.adminId);
  await audit(record.adminId, "UPDATE", "AdminUser", record.adminId, "Password reset");
  return record.admin.email;
}

async function resolvePermissions(adminId: string): Promise<string[]> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  return admin ? admin.role.rolePermissions.map((rp) => rp.permission.key) : [];
}

function publicProfile(id: string, name: string, email: string, role: string) {
  return { id, name, email, role };
}