import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { signAccessToken } from "../../lib/jwt";
import { validateBody } from "../../middlewares/validate";
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../../lib/jwt";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name is required").max(120),
    email: z.string().email("Valid email is required"),
    phone: z.string().max(20).optional().nullable(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().email("Valid email is required"),
    password: z.string().min(6),
  })
  .strict();

export interface CustomerRequest extends Request {
  customer?: { id: string; email: string; name: string };
}

export async function authenticateCustomer(req: CustomerRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return fail(res, "Authentication required", 401);
  try {
    const payload = verifyAccessToken(header.slice(7));
    const customer = await prisma.customer.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, status: true },
    });
    if (!customer || customer.status !== "ACTIVE") return fail(res, "Customer account is not active", 401);
    req.customer = customer;
    next();
  } catch {
    return fail(res, "Invalid or expired token", 401);
  }
}

function issueTokens(customer: { id: string; name: string; email: string }) {
  return {
    accessToken: signAccessToken({ sub: customer.id, email: customer.email, role: "CUSTOMER", version: 1 }),
    customer: { id: customer.id, name: customer.name, email: customer.email },
  };
}

const router = Router();

router.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, phone, password } = req.body;
    const normalized = email.toLowerCase().trim();
    const existing = await prisma.customer.findUnique({ where: { email: normalized } });
    if (existing) return fail(res, "An account with this email already exists", 409);
    const customer = await prisma.customer.create({
      data: { name, email: normalized, phone: phone ?? null, passwordHash: await hashPassword(password) },
    });
    return ok(res, issueTokens(customer), "Account created", 201);
  })
);

router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const customer = await prisma.customer.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!customer || !customer.passwordHash) return fail(res, "Invalid email or password", 401);
    const valid = await verifyPassword(password, customer.passwordHash);
    if (!valid) return fail(res, "Invalid email or password", 401);
    if (customer.status !== "ACTIVE") return fail(res, "Account is blocked", 403);
    return ok(res, issueTokens(customer), "Login successful");
  })
);

router.get(
  "/me",
  authenticateCustomer,
  asyncHandler(async (req: CustomerRequest, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.customer!.id },
      include: {
        addresses: { orderBy: { isDefault: "desc" } },
        orders: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, orderNumber: true, grandTotal: true, orderStatus: true, createdAt: true } },
      },
    });
    if (!customer) return fail(res, "Customer not found", 404);
    return ok(res, {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      totalSpent: Number(customer.totalSpent),
      addressCount: customer.addresses.length,
      recentOrders: customer.orders,
      createdAt: customer.createdAt,
    });
  })
);

export default router;