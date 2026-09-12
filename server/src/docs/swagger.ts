const tagDefinitions = [
  { name: "Auth", description: "Staff/admin authentication (login, refresh, password flows)" },
  { name: "Store", description: "Public storefront APIs: catalog, settings, cart, checkout" },
  { name: "Catalog", description: "Admin: products, categories, brands, tax rules" },
  { name: "Inventory", description: "Admin: inventory movements and stock adjustments" },
  { name: "Promotions", description: "Admin: coupons / discounts" },
  { name: "Orders", description: "Orders: store checkout + admin order management" },
  { name: "Customers", description: "Admin: customer management" },
  { name: "Settings", description: "Admin: store settings" },
  { name: "Admins", description: "Admin: staff users, roles and permissions" },
  { name: "Reports", description: "Admin: sales, revenue and stock reports" },
  { name: "Audit", description: "Admin: audit logs" },
];

const bearerAuth = { bearerAuth: [] as string[] };

const apiResponse = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    message: { type: "string" },
    data: { nullable: true, oneOf: [{ type: "object" }, { type: "array", items: { type: "object" } }] },
  },
};

const pagination = {
  type: "object",
  properties: {
    items: { type: "array", items: { type: "object" } },
    total: { type: "integer" },
    page: { type: "integer" },
    pageSize: { type: "integer" },
    totalPages: { type: "integer" },
  },
};

const schemas: Record<string, any> = {
  ApiResponse: apiResponse,
  Pagination: pagination,
  ErrorResponse: { type: "object", properties: { success: { type: "boolean", example: false }, message: { type: "string" } } },
  LoginRequest: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } } },
  RefreshRequest: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
  Address: {
    type: "object",
    required: ["fullName", "phone", "line1", "city"],
    properties: {
      fullName: { type: "string", minLength: 2 },
      phone: { type: "string", minLength: 7 },
      line1: { type: "string", minLength: 2 },
      line2: { type: "string" },
      city: { type: "string", minLength: 2 },
      state: { type: "string" },
      postalCode: { type: "string" },
      country: { type: "string", default: "Pakistan" },
    },
  },
  OrderItemInput: { type: "object", required: ["productId", "qty"], properties: { productId: { type: "string" }, qty: { type: "integer", minimum: 1, maximum: 999 } } },
  OrderCreate: {
    type: "object",
    required: ["items", "address"],
    properties: {
      sessionId: { type: "string" },
      customer: { type: "object", properties: { name: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string" } } },
      address: { $ref: "#/components/schemas/Address" },
      items: { type: "array", items: { $ref: "#/components/schemas/OrderItemInput" } },
      couponCode: { type: "string", maxLength: 40 },
      paymentMethod: { type: "string", enum: ["COD", "BANK_TRANSFER", "CARD", "OTHER"], default: "COD" },
      note: { type: "string", maxLength: 500 },
    },
  },
  Product: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      slug: { type: "string" },
      sku: { type: "string" },
      description: { type: "string" },
      sellingPrice: { type: "number" },
      buyingPrice: { type: "number" },
      stock: { type: "integer" },
      active: { type: "boolean" },
      categoryId: { type: "string" },
      brandId: { type: "string" },
      images: { type: "array", items: { type: "object" } },
    },
  },
  Category: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, active: { type: "boolean" } } },
  Coupon: {
    type: "object",
    properties: {
      id: { type: "string" },
      code: { type: "string" },
      type: { type: "string", enum: ["PERCENT", "FIXED", "FREE_SHIPPING"] },
      value: { type: "number" },
      minOrderAmount: { type: "number" },
      maxDiscount: { type: "number" },
      usageLimit: { type: "integer" },
      perCustomerLimit: { type: "integer" },
      active: { type: "boolean" },
    },
  },
  TaxRule: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, rate: { type: "number" }, active: { type: "boolean" } } },
  InventoryMovement: { type: "object", properties: { id: { type: "string" }, type: { type: "string" }, quantity: { type: "integer" }, note: { type: "string" } } },
  Customer: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, status: { type: "string" } } },
  Role: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, rolePermissions: { type: "array", items: { type: "object" } } } },
  Permission: { type: "object", properties: { id: { type: "string" }, key: { type: "string" }, description: { type: "string" } } },
  ReportSummary: { type: "object", properties: { revenue: { type: "number" }, orders: { type: "integer" }, products: { type: "integer" }, customers: { type: "integer" } } },
};

export const swaggerSpec = {
  openapi: "3.1.0",
  info: {
    title: "ShopVerse API",
    version: "1.0.0",
    description: "REST API for the ShopVerse e-commerce platform: public storefront endpoints and the `/api/admin/*` RBAC-protected dashboard endpoints.\n\nAuth via `POST /api/auth/login` → `{ accessToken, refreshToken }`. Send `Authorization: Bearer <accessToken>` for admin routes.",
    contact: { name: "ShopVerse" },
  },
  servers: [{ url: "http://localhost:5000", description: "Local (dev) server" }],
  tags: tagDefinitions,
  components: {
    schemas,
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
  },
  paths: {
    // ---------------- Auth ----------------
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login (staff/admin)",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
        responses: {
          200: { description: "Tokens + profile (permissions are returned at top level)", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiResponse" } } } },
          401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate refresh token (opaque, single-use)",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RefreshRequest" } } } },
        responses: { 200: { description: "New access + refresh tokens" }, 401: { description: "Invalid/expired/reused token" } },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke refresh token",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RefreshRequest" } } } },
        responses: { 200: { description: "Revoked" } },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current profile + resolved permissions",
        security: [bearerAuth],
        responses: { 200: { description: "Profile" }, 401: { description: "Missing/invalid token" } },
      },
    },
    "/api/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset link (dev: returns token in response)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } } },
        responses: { 200: { description: "Reset link/token created" } },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with token",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["token", "newPassword"], properties: { token: { type: "string" }, newPassword: { type: "string", minLength: 8 } } } } } },
        responses: { 200: { description: "Password updated" } },
      },
    },
    "/api/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change own password",
        security: [bearerAuth],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["currentPassword", "newPassword"], properties: { currentPassword: { type: "string" }, newPassword: { type: "string", minLength: 8 } } } } } },
        responses: { 200: { description: "Password changed" } },
      },
    },

    // ---------------- Store ----------------
    "/api/store/products": {
      get: {
        tags: ["Store"],
        summary: "Public product catalog (active products only, searchable, paginated)",
        parameters: [
          { in: "query", name: "search", schema: { type: "string" }, description: "Name/SKU contains" },
          { in: "query", name: "category", schema: { type: "string" }, description: "Category slug" },
          { in: "query", name: "page", schema: { type: "integer", default: 1 } },
          { in: "query", name: "pageSize", schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: { 200: { description: "Paginated products", content: { "application/json": { schema: { $ref: "#/components/schemas/Pagination" } } } } },
      },
    },
    "/api/store/products/{slug}": {
      get: {
        tags: ["Store"],
        summary: "Product detail by slug",
        parameters: [{ in: "path", name: "slug", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Product" }, 404: { description: "Not found" } },
      },
    },
    "/api/store/categories": {
      get: {
        tags: ["Store"],
        summary: "Public categories (active, with product counts)",
        responses: { 200: { description: "Categories" } },
      },
    },
    "/api/store/brands": {
      get: {
        tags: ["Store"],
        summary: "Public brands (active, with product counts)",
        responses: { 200: { description: "Brands" } },
      },
    },
    "/api/store/settings": {
      get: {
        tags: ["Store"],
        summary: "Public store settings (name, currency, branding only)",
        responses: { 200: { description: "Settings map" } },
      },
    },
    "/api/store/orders": {
      post: {
        tags: ["Orders"],
        summary: "Place an order (storefront checkout)",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OrderCreate" } } } },
        responses: {
          201: { description: "Order created (order number `SV-YYYY-######` returned)" },
          404: { description: "Product/coupon not found" },
          409: { description: "Insufficient stock / duplicate conflict" },
          422: { description: "Validation failed" },
        },
      },
    },
    "/api/store/orders/track/{orderNumber}": {
      get: {
        tags: ["Orders"],
        summary: "Track an order by number",
        parameters: [{ in: "path", name: "orderNumber", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Order + status history" }, 404: { description: "Not found" } },
      },
    },
    "/api/store/cart": {
      get: {
        tags: ["Store"],
        summary: "Get cart by sessionId",
        parameters: [{ in: "query", name: "sessionId", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Cart" } },
      },
    },
    "/api/store/cart/items": {
      post: {
        tags: ["Store"],
        summary: "Add item to cart",
        responses: { 201: { description: "Cart updated" } },
      },
    },
    "/api/store/cart/items/{id}": {
      patch: {
        tags: ["Store"],
        summary: "Update item quantity",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Cart updated" } },
      },
      delete: {
        tags: ["Store"],
        summary: "Remove item from cart",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Cart updated" } },
      },
    },

    // ---------------- Admin: Catalog ----------------
    "/api/admin/products": {
      get: {
        tags: ["Catalog"],
        summary: "List products (incl. soft-deleted, search/filter)",
        security: [bearerAuth],
        responses: { 200: { description: "Products" }, 403: { description: "Forbidden" } },
      },
      post: {
        tags: ["Catalog"],
        summary: "Create product",
        security: [bearerAuth],
        responses: { 201: { description: "Created" }, 409: { description: "Duplicate SKU" }, 422: { description: "Validation failed" } },
      },
    },
    "/api/admin/products/{id}": {
      get: { tags: ["Catalog"], summary: "Get product", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Product" } } },
      put: { tags: ["Catalog"], summary: "Update product", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated" } } },
      delete: { tags: ["Catalog"], summary: "Soft-delete product", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deleted" } } },
    },
    "/api/admin/categories": {
      get: { tags: ["Catalog"], summary: "List categories", security: [bearerAuth], responses: { 200: { description: "Categories" } } },
      post: { tags: ["Catalog"], summary: "Create category", security: [bearerAuth], responses: { 201: { description: "Created" }, 409: { description: "Duplicate slug" } } },
    },
    "/api/admin/categories/{id}": {
      put: { tags: ["Catalog"], summary: "Update category", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated" } } },
      delete: { tags: ["Catalog"], summary: "Delete category", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deleted" } } },
    },
    "/api/admin/brands": {
      get: { tags: ["Catalog"], summary: "List brands", security: [bearerAuth], responses: { 200: { description: "Brands" } } },
      post: { tags: ["Catalog"], summary: "Create brand", security: [bearerAuth], responses: { 201: { description: "Created" } } },
    },
    "/api/admin/tax-rules": {
      get: { tags: ["Catalog"], summary: "List tax rules", security: [bearerAuth], responses: { 200: { description: "Rules" } } },
      post: { tags: ["Catalog"], summary: "Create tax rule", security: [bearerAuth], responses: { 201: { description: "Created" } } },
    },

    // ---------------- Admin: Inventory ----------------
    "/api/admin/inventory": {
      get: { tags: ["Inventory"], summary: "List inventory movements", security: [bearerAuth], responses: { 200: { description: "Movements" } } },
      post: {
        tags: ["Inventory"],
        summary: "Adjust stock (IN/OUT/ADJUST)",
        security: [bearerAuth],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["productId", "type", "quantity"], properties: { productId: { type: "string" }, type: { type: "string", enum: ["IN", "OUT", "ADJUST"] }, quantity: { type: "number" }, note: { type: "string" } } } } } },
        responses: { 201: { description: "Movement recorded" } },
      },
    },
    "/api/admin/inventory/low-stock": {
      get: { tags: ["Inventory"], summary: "Low stock alerts", security: [bearerAuth], responses: { 200: { description: "Products below threshold" } } },
    },

    // ---------------- Admin: Promotions ----------------
    "/api/admin/coupons": {
      get: { tags: ["Promotions"], summary: "List coupons", security: [bearerAuth], responses: { 200: { description: "Coupons" } } },
      post: { tags: ["Promotions"], summary: "Create coupon", security: [bearerAuth], responses: { 201: { description: "Created" }, 409: { description: "Duplicate code" } } },
    },
    "/api/admin/coupons/{id}": {
      put: { tags: ["Promotions"], summary: "Update coupon", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated" } } },
      delete: { tags: ["Promotions"], summary: "Delete coupon", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deleted" } } },
    },

    // ---------------- Orders (admin) ----------------
    "/api/admin/orders": {
      get: { tags: ["Orders"], summary: "List orders (filters: status, payment, date range)", security: [bearerAuth], responses: { 200: { description: "Orders" } } },
    },
    "/api/admin/orders/{id}": {
      get: { tags: ["Orders"], summary: "Order detail", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Order" } } },
    },
    "/api/admin/orders/{id}/status": {
      patch: {
        tags: ["Orders"],
        summary: "Update order status (PENDING→…→DELIVERED/CANCELLED etc; CANCELLED restores stock)",
        security: [bearerAuth],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["orderStatus"], properties: { orderStatus: { type: "string", enum: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"] }, note: { type: "string" } } } } } },
        responses: { 200: { description: "Status updated" } },
      },
    },
    "/api/admin/orders/{id}/payments": {
      post: { tags: ["Orders"], summary: "Record a payment against an order", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 201: { description: "Payment recorded" } } },
    },

    // ---------------- Customers ----------------
    "/api/admin/customers": {
      get: { tags: ["Customers"], summary: "List customers (search/status filter)", security: [bearerAuth], responses: { 200: { description: "Customers" } } },
    },
    "/api/admin/customers/{id}": {
      get: { tags: ["Customers"], summary: "Customer detail (addresses + recent orders)", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Customer" } } },
    },
    "/api/admin/customers/{id}/status": {
      patch: { tags: ["Customers"], summary: "Block / activate customer", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Status updated" } } },
    },

    // ---------------- Settings ----------------
    "/api/admin/settings": {
      get: { tags: ["Settings"], summary: "All settings grouped", security: [bearerAuth], responses: { 200: { description: "Settings grouped by section" } } },
      put: { tags: ["Settings"], summary: "Save settings (key/value upsert)", security: [bearerAuth], responses: { 200: { description: "Saved" } } },
    },

    // ---------------- Admins ----------------
    "/api/admin/admins": {
      get: { tags: ["Admins"], summary: "List staff users", security: [bearerAuth], responses: { 200: { description: "Admins" } } },
      post: { tags: ["Admins"], summary: "Create staff user", security: [bearerAuth], responses: { 201: { description: "Created" } } },
    },
    "/api/admin/admins/roles": {
      get: { tags: ["Admins"], summary: "List roles with permissions", security: [bearerAuth], responses: { 200: { description: "Roles" } } },
    },
    "/api/admin/admins/permissions": {
      get: { tags: ["Admins"], summary: "List all permission keys", security: [bearerAuth], responses: { 200: { description: "Permissions" } } },
    },
    "/api/admin/admins/{id}": {
      put: { tags: ["Admins"], summary: "Update staff user (role/permissions/active)", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated" } } },
      delete: { tags: ["Admins"], summary: "Delete staff user", security: [bearerAuth], parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { 200: { description: "Deleted" } } },
    },

    // ---------------- Reports ----------------
    "/api/admin/reports/summary": {
      get: { tags: ["Reports"], summary: "Dashboard summary (revenue, orders, products, customers)", security: [bearerAuth], responses: { 200: { description: "Summary" } } },
    },
    "/api/admin/reports/revenue": {
      get: { tags: ["Reports"], summary: "Revenue by day/month for a range", security: [bearerAuth], responses: { 200: { description: "Series" } } },
    },
    "/api/admin/reports/top-products": {
      get: { tags: ["Reports"], summary: "Top products by revenue", security: [bearerAuth], responses: { 200: { description: "Ranking" } } },
    },
    "/api/admin/reports/stock-value": {
      get: { tags: ["Reports"], summary: "Current stock value", security: [bearerAuth], responses: { 200: { description: "Value" } } },
    },

    // ---------------- Audit ----------------
    "/api/admin/audit-logs": {
      get: { tags: ["Audit"], summary: "List audit logs (search/paginated)", security: [bearerAuth], responses: { 200: { description: "Logs" } } },
    },

    "/health": {
      get: { summary: "Liveness probe", responses: { 200: { description: "OK" } } },
    },
  },
};

export default swaggerSpec;