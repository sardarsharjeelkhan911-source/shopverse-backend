import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { rateLimit } from "express-rate-limit";

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: "Route not found", data: null });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message, data: null });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      data: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? (err.meta!.target as string[]).join(", ") : "field";
      return res.status(409).json({ success: false, message: `Duplicate value on ${target}`, data: null });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, message: "Record not found", data: null });
    }
    return res.status(400).json({ success: false, message: "Database error", data: null });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error", data: null });
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 100000 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try again later.", data: null },
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 100000 : 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests", data: null },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 100000 : 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests", data: null },
});