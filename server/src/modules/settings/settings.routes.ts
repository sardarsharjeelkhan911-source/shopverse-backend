import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/helpers";
import { ok, fail } from "../../utils/response";
import { prisma } from "../../lib/prisma";
import { authenticate, authorize, AuthedRequest } from "../../middlewares/auth";
import { validateBody } from "../../middlewares/validate";
import { audit } from "../audit/audit";

const settingSchema = z
  .object({
    key: z.string().min(1).max(80),
    value: z.string().max(2000),
    group: z.string().max(40).default("general"),
  })
  .strict();

const updateSettingsSchema = z
  .object({
    settings: z.array(settingSchema).min(1).max(100),
  })
  .strict();

const PUBLIC_KEYS = ["store_name", "store_tagline", "currency", "currency_symbol", "support_phone", "support_email", "announcement", "hero_title", "hero_subtitle"];

// ===== Public =====
export const publicRouter = Router();

publicRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await prisma.storeSetting.findMany({ orderBy: { key: "asc" } });
    const data: Record<string, string> = {};
    for (const s of settings) {
      if (PUBLIC_KEYS.includes(s.key)) {
        try {
          data[s.key] = JSON.parse(s.value);
        } catch {
          data[s.key] = s.value;
        }
      }
    }
    return ok(res, { ...data, currency: data.currency ?? "PKR", currencySymbol: data.currency === "PKR" ? "₨" : "₹" });
  })
);

// ===== Admin =====
export const adminRouter = Router();
adminRouter.use(authenticate);

adminRouter.get(
  "/",
  authorize("settings"),
  asyncHandler(async (_req, res) => {
    const settings = await prisma.storeSetting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
    const grouped: Record<string, Record<string, unknown>> = {};
    for (const s of settings) {
      if (!grouped[s.group]) grouped[s.group] = {};
      try {
        grouped[s.group][s.key] = JSON.parse(s.value);
      } catch {
        grouped[s.group][s.key] = s.value;
      }
    }
    return ok(res, grouped);
  })
);

adminRouter.put(
  "/",
  authorize("settings"),
  validateBody(updateSettingsSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const results: string[] = [];
    for (const s of req.body.settings) {
      await prisma.storeSetting.upsert({
        where: { key: s.key },
        create: { key: s.key, value: JSON.stringify(s.value), group: s.group },
        update: { value: JSON.stringify(s.value), group: s.group },
      });
      results.push(s.key);
    }
    await audit(req.admin!.id, "UPDATE", "StoreSetting", null, `Updated settings: ${results.join(", ")}`);
    return ok(res, { updated: results.length }, "Settings saved");
  })
);

export default publicRouter;