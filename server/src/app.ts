import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { env } from "./env";
import { globalLimiter, notFound, errorHandler } from "./middlewares/error";
import authRoutes from "./modules/auth/auth.routes";
import categoryRoutes, { adminRouter as categoryAdminRouter } from "./modules/categories/category.routes";
import brandRoutes, { adminRouter as brandAdminRouter } from "./modules/brands/brand.routes";
import productRoutes, { adminRouter as productAdminRouter } from "./modules/products/product.routes";
import taxAdminRouter from "./modules/tax-rules/tax.routes";
import inventoryAdminRouter from "./modules/inventory/inventory.routes";
import couponAdminRouter from "./modules/coupons/coupon.routes";
import cartRoutes from "./modules/cart/cart.routes";
import customerAuthRoutes from "./modules/customers/customer.auth";
import customerAdminRouter from "./modules/customers/customer.admin";
import orderRoutes from "./modules/orders/order.routes";
import orderAdminRouter from "./modules/orders/order.admin";
import settingsRoutes, { adminRouter as settingsAdminRouter } from "./modules/settings/settings.routes";
import adminsRouter from "./modules/admins/admins.routes";
import reportsRouter from "./modules/reports/reports.routes";
import auditRoutes from "./modules/audit/audit.routes";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./docs/swagger";

const app = express();

// Security headers
app.use(helmet());

// CORS — allow the configured origins
const origins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
app.use(
  cors({
    origin: origins.length ? origins : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(globalLimiter);

// Static uploads
const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

// Health
app.get("/health", (_req, res) => res.json({ success: true, message: "OK", data: { uptime: process.uptime() } }));

// API routes
// Store (public)
app.use("/api/store/products", productRoutes);
app.use("/api/store/categories", categoryRoutes);
app.use("/api/store/brands", brandRoutes);
app.use("/api/store/cart", cartRoutes);
app.use("/api/store/auth", customerAuthRoutes);
app.use("/api/store/orders", orderRoutes);
app.use("/api/store/settings", settingsRoutes);

// Admin (auth enforced inside admin routers)
app.use("/api/admin/products", productAdminRouter);
app.use("/api/admin/categories", categoryAdminRouter);
app.use("/api/admin/brands", brandAdminRouter);
app.use("/api/admin/tax-rules", taxAdminRouter);
app.use("/api/admin/inventory", inventoryAdminRouter);
app.use("/api/admin/coupons", couponAdminRouter);
app.use("/api/admin/orders", orderAdminRouter);
app.use("/api/admin/settings", settingsAdminRouter);
app.use("/api/admin/admins", adminsRouter);
app.use("/api/admin/reports", reportsRouter);
app.use("/api/admin/audit-logs", auditRoutes);
app.use("/api/admin/customers", customerAdminRouter);

// Auth
app.use("/api/auth", authRoutes);

// API docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "ShopVerse API Docs" }));

// Production: serve built admin dashboard (SPA) when present
const dashboardDist = path.resolve(process.cwd(), "../dashboard/dist");
if (fs.existsSync(dashboardDist)) {
  app.use(express.static(dashboardDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/health")) return next();
    res.sendFile(path.join(dashboardDist, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;