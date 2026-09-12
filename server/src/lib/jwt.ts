import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../env";

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  type: "access" | "refresh";
  version: number;
}

export function signAccessToken(payload: Omit<TokenPayload, "type" | "version"> & { version: number }): string {
  const opts: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, type: "access" }, env.JWT_ACCESS_SECRET, opts);
}

export function signRefreshToken(payload: Omit<TokenPayload, "type" | "version"> & { version: number }): string {
  const opts: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_REFRESH_SECRET, opts);
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
  if (decoded.type !== "access") throw new jwt.JsonWebTokenError("Invalid token type");
  return decoded;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  if (decoded.type !== "refresh") throw new jwt.JsonWebTokenError("Invalid token type");
  return decoded;
}