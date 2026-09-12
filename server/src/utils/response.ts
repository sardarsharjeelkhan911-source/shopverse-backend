import type { Response } from "express";

/** Consistent JSON envelope for every API response. */
export function ok(res: Response, data: unknown, message = "Success", status = 200): Response {
  return res.status(status).json({ success: true, message, data });
}

export function fail(res: Response, message: string, status = 400): Response {
  return res.status(status).json({ success: false, message, data: null });
}