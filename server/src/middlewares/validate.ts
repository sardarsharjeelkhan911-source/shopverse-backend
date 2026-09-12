import { RequestHandler } from "express";
import { z, ZodError } from "zod";
import { fail } from "../utils/response";

/** Validate req.params (schema); call next when valid. */
export function validateParams(schema: z.ZodSchema): RequestHandler {
  return (req, res, next) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return fail(res, "Invalid parameters: " + e.issues.map((i) => i.message).join(", "), 422);
      }
      next(e);
    }
  };
}

/** Validate req.query (schema); attach sanitized value to res.locals.query. */
export function validateQuery(schema: z.ZodSchema): RequestHandler {
  return (req, res, next) => {
    try {
      res.locals.query = schema.parse(req.query);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return fail(res, "Invalid query: " + e.issues.map((i) => i.message).join(", "), 422);
      }
      next(e);
    }
  };
}

/** Validate req.body (schema); attach sanitized value to req.body. */
export function validateBody(schema: z.ZodSchema): RequestHandler {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return fail(res, "Invalid body: " + e.issues.map((i) => i.message).join(", "), 422);
      }
      next(e);
    }
  };
}