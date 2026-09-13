import { PrismaClient } from "@prisma/client";

// Supabase/Vercel Storage exposes the connection as POSTGRES_PRISMA_URL.
// Bridge it to DATABASE_URL so the same app works on SQLite and Supabase.
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}

export const prisma = new PrismaClient();

/** Allowed order lifecycle statuses. */
export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
] as const;

export const PAYMENT_STATUSES = ["UNPAID", "PAID", "PARTIALLY_PAID", "REFUNDED", "FAILED"] as const;
export const PAYMENT_METHODS = ["COD", "BANK_TRANSFER", "CARD", "OTHER"] as const;

export const UNITS = ["piece", "kg", "gram", "liter", "ml", "box", "packet", "dozen"] as const;
export const INVENTORY_TYPES = ["IN", "OUT", "ADJUST", "RESERVE", "RELEASE", "COST", "REFUND"] as const;

export const ROUNDING_STRATEGIES = {
  ROUND_UP: (n: number) => Math.ceil(n),
  ROUND_DOWN: (n: number) => Math.floor(n),
  ROUND_HALF_UP: (n: number) => Math.round(n),
  NONE: (n: number) => n,
} as const;

/** Permission keys used by RBAC. */
export const PERMISSION_KEYS = [
  "dashboard",
  "products",
  "categories",
  "brands",
  "inventory",
  "orders",
  "customers",
  "discounts",
  "taxes",
  "reports",
  "admins",
  "settings",
] as const;

/** Built-in roles and the permissions each role receives by default. */
export const DEFAULT_ROLES: Record<string, string[]> = {
  SUPER_ADMIN: [...PERMISSION_KEYS],
  ADMIN: [...PERMISSION_KEYS],
  MANAGER: [
    "dashboard",
    "products",
    "categories",
    "brands",
    "inventory",
    "orders",
    "customers",
    "discounts",
    "taxes",
    "reports",
  ],
  STAFF: ["dashboard", "products", "inventory", "orders", "customers"],
};