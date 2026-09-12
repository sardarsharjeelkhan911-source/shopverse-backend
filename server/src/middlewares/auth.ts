import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { HttpError } from "./error";
import { fail } from "../utils/response";

export interface AuthedRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

/**
 * Authentication middleware: requires a valid access token.
 * Resolves the admin and their resolved permissions from the database.
 */
export async function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return fail(res, "Authentication required", 401);
  }
  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
      },
    });
    if (!admin || !admin.active) {
      return fail(res, "Account is inactive or missing", 401);
    }
    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role.name,
      permissions: admin.role.rolePermissions.map((rp) => rp.permission.key),
    };
    next();
  } catch {
    return fail(res, "Invalid or expired token", 401);
  }
}

/** Role & permission authorization middleware. */
export function authorize(permission?: string) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.admin) return next(new HttpError("Unauthorized", 401));
    if (req.admin.role === "SUPER_ADMIN") return next();
    if (!permission) return next();
    if (req.admin.permissions.includes(permission)) return next();
    return next(new HttpError("You do not have permission to perform this action", 403));
  };
}