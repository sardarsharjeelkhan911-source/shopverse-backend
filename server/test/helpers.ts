import supertest from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

export { app, prisma };

export const api = supertest(app);

export const ADMIN_EMAIL = "superadmin@shopverse.pk";
export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin45";

export const STAFF_EMAIL = "storef@shopverse.pk";
export const STAFF_USERNAME = "storef";
export const STAFF_PASSWORD = "storef65";

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  admin: { id: string; name: string; username?: string | null; email: string; role: string; permissions: string[] };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function loginAdmin(email = ADMIN_EMAIL, password = ADMIN_PASSWORD): Promise<AuthData> {
  const res = await api.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error("login failed: " + JSON.stringify(res.body));
  return res.body.data as AuthData;
}

export async function ensureAdmin(email: string, role: "ADMIN" | "MANAGER" | "STAFF"): Promise<AuthData> {
  const roleRec = await prisma.role.findUniqueOrThrow({ where: { name: role } });
  await prisma.adminUser.upsert({
    where: { email },
    update: { roleId: roleRec.id, active: true },
    create: { name: email.split("@")[0], email, passwordHash: await hashPassword("Test@12345"), roleId: roleRec.id },
  });
  const res = await api.post("/api/auth/login").send({ email, password: "Test@12345" });
  if (res.status !== 200) throw new Error("staff login failed: " + JSON.stringify(res.body));
  return res.body.data as AuthData;
}

export function unique(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}