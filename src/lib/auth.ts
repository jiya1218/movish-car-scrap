import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { ROLE_NAV_ACCESS, type RoleCode } from "./constants";

const SESSION_COOKIE_NAME = "movish_bms_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || "movish-group-bms-gujarat-secure-session-key-2026";
}

/**
 * Hashes a plain-text password using salted scrypt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a plain-text password against a stored scrypt hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  roleCode: RoleCode;
  roleName: string;
  employeeId: string | null;
  exp: number;
}

/**
 * Signs a session payload into a compact HMAC-SHA256 verified token.
 */
export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

/**
 * Verifies and decodes a session token, returning null when invalid or expired.
 */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthenticatedContext {
  userId: string;
  email: string;
  name: string;
  roleCode: RoleCode;
  roleName: string;
  employeeId: string | null;
  permissions: string[];
  allowedModules: string[];
}

/**
 * Resolves the currently authenticated user and live DB permissions from cookies.
 */
export async function getSessionContext(): Promise<AuthenticatedContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionToken(rawToken);
  if (!parsed) return null;

  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    include: {
      role: {
        include: {
          permissions: {
            where: { allowed: true },
            include: { permission: true },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const roleCode = user.role.code as RoleCode;
  const permissions = user.role.permissions.map((rp) => rp.permission.code);
  const allowedModules = ROLE_NAV_ACCESS[roleCode] ?? ["dashboard"];

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roleCode,
    roleName: user.role.name,
    employeeId: user.employeeId,
    permissions,
    allowedModules,
  };
}

/**
 * Checks whether a session holds a required permission or Super Admin access.
 */
export function canPerform(ctx: AuthenticatedContext | null, permissionCode: string): boolean {
  if (!ctx) return false;
  if (ctx.roleCode === "SUPER_ADMIN") return true;
  return ctx.permissions.includes(permissionCode);
}

/**
 * Helper to set the HTTP-only session cookie.
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

/**
 * Helper to clear the HTTP-only session cookie.
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
