import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateBody, validateQuery } from "../../middlewares/validate";
import { hashPassword } from "../../lib/password";
import { audit } from "../audit/audit";
import { paginateArgs, meta } from "../../utils/pagination";

const router = Router();
router.use(authenticate);

const createAdminSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    roleId: z.string().cuid().optional(),
    active: z.boolean().default(true),
  })
  .strict();

const updateAdminSchema = createAdminSchema
  .partial()
  .extend({ password: z.string().min(8).optional() })
  .strict();

const roleSchema = z
  .object({
    name: z.string().min(2).max(40),
    description: z.string().max(200).optional().nullable(),
    permissionKeys: z.array(z.string().min(1)).default([]),
  })
  .strict();

const adminQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional().default(""),
    active: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  })
  .strict();

function serializeAdmin(a: any) {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role ? { id: a.role.id, name: a.role.name } : null,
    active: a.active,
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
  };
}

// ---- Roles & permissions ----
router.get(
  "/permissions",
  authorize("admins"),
  asyncHandler(async (_req, res) => {
    const permissions = await prisma.permission.findMany({ orderBy: { key: "asc" } });
    return ok(res, { items: permissions.map((p) => ({ id: p.id, key: p.key, description: p.description })) });
  })
);

router.get(
  "/roles",
  authorize("admins"),
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        rolePermissions: { include: { permission: { select: { key: true } } } },
        _count: { select: { adminUsers: true } },
      },
    });
    return ok(
      res,
      {
        items: roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
          adminCount: r._count.adminUsers,
          permissionKeys: r.rolePermissions.map((rp) => rp.permission.key),
        })),
      }
    );
  })
);

router.post(
  "/roles",
  validateBody(roleSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin!.role !== "SUPER_ADMIN") return fail(res, "Only SUPER_ADMIN can manage roles", 403);
    const dup = await prisma.role.findUnique({ where: { name: req.body.name } });
    if (dup) return fail(res, "Role already exists", 409);
    const role = await prisma.role.create({
      data: {
        name: req.body.name,
        description: req.body.description ?? null,
        rolePermissions: {
          create: req.body.permissionKeys.map((key: string) => ({ permission: { connect: { key } } })),
        },
      },
    });
    await audit(req.admin!.id, "CREATE", "Role", role.id, `Created role ${role.name}`);
    return ok(res, role, "Role created", 201);
  })
);

router.put(
  "/roles/:id",
  validateBody(roleSchema.partial().strict()),
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin!.role !== "SUPER_ADMIN") return fail(res, "Only SUPER_ADMIN can manage roles", 403);
    const existing = await prisma.role.findUnique({ where: { id: req.params.id }, include: { rolePermissions: true } });
    if (!existing) return fail(res, "Role not found", 404);
    if (existing.name === "SUPER_ADMIN") return fail(res, "SUPER_ADMIN role cannot be edited", 400);

    const data: any = {};
    if (req.body.name) data.name = req.body.name;
    if (req.body.description !== undefined) data.description = req.body.description;

    if (req.body.permissionKeys) {
      const set = req.body.permissionKeys;
      void existing;
      data.rolePermissions = {
        deleteMany: {},
        create: set.map((key: string) => ({ permission: { connect: { key } } })),
      };
    }
    const role = await prisma.role.update({ where: { id: req.params.id }, data });
    await audit(req.admin!.id, "UPDATE", "Role", role.id, `Updated role ${role.name}`);
    return ok(res, role, "Role updated");
  })
);

// ---- Admin users ----
router.get(
  "/",
  authorize("admins"),
  validateQuery(adminQuery),
  asyncHandler(async (_req, res) => {
    const q = res.locals.query;
    const { take, skip } = paginateArgs(q);
    const where: any = {
      ...(q.search ? { OR: [{ name: { contains: q.search } }, { email: { contains: q.search } }] } : {}),
      ...(q.active !== undefined ? { active: q.active } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.adminUser.findMany({ where, take, skip, orderBy: { createdAt: "desc" }, include: { role: { select: { id: true, name: true } } } }),
      prisma.adminUser.count({ where }),
    ]);
    return ok(res, { items: items.map(serializeAdmin), ...meta(q, total) });
  })
);

router.post(
  "/",
  validateBody(createAdminSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.admin!.role !== "SUPER_ADMIN") return fail(res, "Only SUPER_ADMIN can create admins", 403);
    const { name, email, password, roleId, active } = req.body;
    const normalized = email.toLowerCase().trim();
    const dup = await prisma.adminUser.findUnique({ where: { email: normalized } });
    if (dup) return fail(res, "Email already in use", 409);

    let role = await prisma.role.findUnique({ where: { name: "STAFF" } });
    if (roleId) role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return fail(res, "Role not found", 422);

    const admin = await prisma.adminUser.create({
      data: { name, email: normalized, passwordHash: await hashPassword(password), roleId: role.id, active },
      include: { role: { select: { id: true, name: true } } },
    });
    await audit(req.admin!.id, "CREATE", "AdminUser", admin.id, `Created admin ${admin.email} (${role.name})`);
    return ok(res, serializeAdmin(admin), "Admin created", 201);
  })
);

router.put(
  "/:id",
  validateBody(updateAdminSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const target = await prisma.adminUser.findUnique({ where: { id: req.params.id }, include: { role: true } });
    if (!target) return fail(res, "Admin not found", 404);
    if (target.id === req.admin!.id && req.body.active === false) return fail(res, "You cannot disable your own account", 400);
    if (target.role?.name === "SUPER_ADMIN" && req.admin!.role !== "SUPER_ADMIN") return fail(res, "Only SUPER_ADMIN can manage other super admins", 403);

    const data: any = {};
    if (req.body.name) data.name = req.body.name;
    if (req.body.email) {
      const normalized = req.body.email.toLowerCase().trim();
      const dup = await prisma.adminUser.findFirst({ where: { email: normalized, id: { not: target.id } } });
      if (dup) return fail(res, "Email already in use", 409);
      data.email = normalized;
    }
    if (req.body.password) data.passwordHash = await hashPassword(req.body.password);
    if (req.body.active !== undefined) data.active = req.body.active;
    if (req.body.roleId) {
      const roleExists = await prisma.role.findUnique({ where: { id: req.body.roleId } });
      if (!roleExists) return fail(res, "Role not found", 422);
      if (target.id === req.admin!.id && req.body.roleId !== target.roleId) {
        return fail(res, "You cannot change your own role", 400);
      }
      data.roleId = req.body.roleId;
    }

    const admin = await prisma.adminUser.update({
      where: { id: target.id },
      data,
      include: { role: { select: { id: true, name: true } } },
    });
    await audit(req.admin!.id, "UPDATE", "AdminUser", admin.id, `Updated admin ${admin.email}`);
    return ok(res, serializeAdmin(admin), "Admin updated");
  })
);

export default router;