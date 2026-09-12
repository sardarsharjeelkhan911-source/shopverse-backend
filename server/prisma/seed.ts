import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES, PERMISSION_KEYS } from "../src/lib/prisma";

const prisma = new PrismaClient();

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "superadmin@shopverse.pk";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ShopVerse@2026";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Super Admin";

const DEMO_STORE = {
  store_name: "ShopVerse",
  store_tagline: "Online Shopping in Pakistan",
  store_email: "support@shopverse.pk",
  store_phone: "+92 300-1234567",
  store_address: "Karachi, Pakistan",
  support_email: "support@shopverse.pk",
  support_phone: "+92 300-1234567",
  currency: "PKR",
  currency_symbol: "Rs.",
  announcement: "Free shipping on orders above Rs. 3,000",
  hero_title: "Discover Amazing Products",
  hero_subtitle: "Electronics, fashion, gaming and lifestyle products at the best prices.",
  social_links: JSON.stringify([]),
  shipping_enabled: "false",
  shipping_charge: "150",
  free_shipping_threshold: "3000",
  tax_enabled: "false",
  default_tax_rate: "0",
  maintenance_mode: "false",
  payment_methods: JSON.stringify(["COD", "BANK_TRANSFER"]),
  seo_title: "ShopVerse — Online Shopping in Pakistan",
  seo_description: "Electronics, fashion, gaming and lifestyle products at the best prices.",
  email_enabled: "false",
};

async function main() {
  console.log("Seeding database...");

  // 1. Permissions
  const permIds: Record<string, string> = {};
  for (const key of PERMISSION_KEYS) {
    const p = await prisma.permission.upsert({
      where: { key },
      update: { description: `Access to ${key}` },
      create: { key, description: `Access to ${key}` },
    });
    permIds[key] = p.id;
  }

  // 2. Roles + role permissions
  for (const [roleName, perms] of Object.entries(DEFAULT_ROLES)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} role`, isSystem: true },
    });
    for (const key of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permIds[key] } },
        update: {},
        create: { roleId: role.id, permissionId: permIds[key] },
      });
    }
  }

  // 3. Super admin
  const superRole = await prisma.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.adminUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: ADMIN_NAME, passwordHash },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      roleId: superRole.id,
    },
  });
  console.log(`Super admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  // 4. Store settings
  for (const [key, value] of Object.entries(DEMO_STORE)) {
    await prisma.storeSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, group: key.startsWith("seo") ? "seo" : "general" },
    });
  }

  // 5. Demo catalog (development convenience)
  const cats = ["Electronics", "Fashion", "Home & Living", "Gaming"];
  const categoryIds: Record<string, string> = {};
  for (const name of cats) {
    const c = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name), description: `Everything in ${name}` },
    });
    categoryIds[name] = c.id;
  }

  const brandNames = ["TechNova", "UrbanWear", "HomeCraft", "GameZone"];
  const brandIds: Record<string, string> = {};
  for (const name of brandNames) {
    const b = await prisma.brand.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name), description: `${name} products` },
    });
    brandIds[name] = b.id;
  }

  const demoProducts: Array<{
    name: string;
    cat: string;
    brand: string;
    price: number;
    cost: number;
    stock: number;
    minStock: number;
    unit: string;
    desc: string;
  }> = [
    { name: "Wireless Bluetooth Earbuds", cat: "Electronics", brand: "TechNova", price: 2499, cost: 1700, stock: 24, minStock: 5, unit: "piece", desc: "Crystal-clear sound with noise cancellation." },
    { name: "Smart Fitness Band", cat: "Electronics", brand: "TechNova", price: 1899, cost: 1200, stock: 18, minStock: 5, unit: "piece", desc: "Track heart rate, steps and sleep." },
    { name: "Men's Cotton Overshirt", cat: "Fashion", brand: "UrbanWear", price: 2999, cost: 1900, stock: 40, minStock: 8, unit: "piece", desc: "Premium breathable cotton, slim fit." },
    { name: "Ladies Stylish Handbag", cat: "Fashion", brand: "UrbanWear", price: 3499, cost: 2100, stock: 15, minStock: 5, unit: "piece", desc: "Elegant PU leather with gold finishing." },
    { name: "LED Desk Study Lamp", cat: "Home & Living", brand: "HomeCraft", price: 1599, cost: 950, stock: 6, minStock: 10, unit: "piece", desc: "Eye-protection LED with 3 brightness modes." },
    { name: "Non-Stick Cookware Set", cat: "Home & Living", brand: "HomeCraft", price: 5499, cost: 3600, stock: 0, minStock: 4, unit: "set", desc: "Marble-coated 5 piece set." },
    { name: "Mechanical Gaming Keyboard", cat: "Gaming", brand: "GameZone", price: 4999, cost: 3100, stock: 12, minStock: 4, unit: "piece", desc: "RGB-backlit mechanical switches." },
    { name: "Wireless Gaming Mouse", cat: "Gaming", brand: "GameZone", price: 2799, cost: 1700, stock: 9, minStock: 4, unit: "piece", desc: "16000 DPI sensor, ultra-light." },
  ];

  for (const p of demoProducts) {
    const existing = await prisma.product.findUnique({ where: { sku: `SV-${slugify(p.name).toUpperCase().slice(0, 10)}` } });
    if (existing) continue;
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: slugify(p.name),
        description: p.desc,
        shortDescription: p.desc,
        sku: `SV-${slugify(p.name).toUpperCase().slice(0, 10)}`,
        buyingPrice: p.cost,
        sellingPrice: p.price,
        unit: p.unit,
        stock: p.stock,
        minStock: p.minStock,
        active: true,
        featured: true,
        categoryId: categoryIds[p.cat],
        brandId: brandIds[p.brand],
        tags: p.cat,
      },
    });
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        type: "IN",
        quantity: p.stock,
        stockBefore: 0,
        stockAfter: p.stock,
        cost: p.cost,
        reason: "Initial stock (seed)",
      },
    });
  }

  // 6. Flat 17% GST rule (inactive by default — taxEnabled setting controls it)
  const existingTax = await prisma.taxRule.findFirst({ where: { name: "General Sales Tax (GST)" } });
  if (!existingTax) {
    await prisma.taxRule.create({
      data: {
        name: "General Sales Tax (GST)",
        type: "PERCENT",
        rate: 17,
        appliesTo: "ALL",
        active: false,
        isInclusive: false,
      },
    });
  }

  console.log("Seeding complete ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());