import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error";

/** Append an audit log entry. Best-effort; never throws. */
export async function audit(
  adminId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: string,
  ip?: string
) {
  try {
    await prisma.auditLog.create({
      data: { adminId, action, entityType, entityId, details, ip },
    });
  } catch {
    // ignore
  }
}

/**
 * Require permission, throwing a 403 HttpError (used inside controllers).
 */
export function assertPermission(permissions: string[], permission: string, deny?: string) {
  if (!permissions.includes(permission)) {
    throw new HttpError(deny ?? "You do not have permission to perform this action", 403);
  }
}

export async function requirePermission(adminId: string, permission: string) {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  if (!admin) throw new HttpError("Unauthorized", 401);
  if (admin.role.name === "SUPER_ADMIN") return;
  const has = admin.role.rolePermissions.some((rp) => rp.permission.key === permission);
  if (!has) throw new HttpError("You do not have permission to perform this action", 403);
}