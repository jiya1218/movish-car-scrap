import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { BUILTIN_ROLE_ACCOUNTS, type RoleCode } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawIdentifier = String(body.identifier ?? body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!rawIdentifier || !password) {
      return NextResponse.json({ error: "Username/email and password are required." }, { status: 400 });
    }

    // 1. Try persistent database authentication first
    let dbUser: {
      id: string;
      email: string;
      name: string;
      passwordHash: string;
      isActive: boolean;
      employeeId: string | null;
      role: { code: string; name: string };
    } | null = null;
    let dbAvailable = true;

    try {
      dbUser = rawIdentifier.includes("@")
        ? await prisma.user.findUnique({
            where: { email: rawIdentifier },
            include: { role: true },
          })
        : await prisma.user.findFirst({
            where: {
              OR: [
                { email: { startsWith: `${rawIdentifier}@` } },
                { name: rawIdentifier },
              ],
            },
            include: { role: true },
          });
    } catch {
      dbAvailable = false;
    }

    if (dbUser) {
      if (!dbUser.isActive || !verifyPassword(password, dbUser.passwordHash)) {
        return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
      }

      try {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { lastLoginAt: new Date() },
        });
      } catch {}

      const token = createSessionToken({
        userId: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        roleCode: dbUser.role.code as RoleCode,
        roleName: dbUser.role.name,
        employeeId: dbUser.employeeId,
      });

      await setSessionCookie(token);

      await logAudit({
        actorUserId: dbUser.id,
        actorName: dbUser.name,
        action: "LOGIN",
        entityType: "User",
        entityId: dbUser.id,
        summary: `${dbUser.name} (${dbUser.role.name}) signed in.`,
      });

      return NextResponse.json({
        user: {
          userId: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          roleCode: dbUser.role.code,
          roleName: dbUser.role.name,
          employeeId: dbUser.employeeId,
        },
      });
    }

    // 2. Fallback to built-in role credentials when database is unavailable or unseeded (stateless auth)
    if (!dbAvailable || (await prisma.user.count().catch(() => 0)) === 0) {
      const matched = BUILTIN_ROLE_ACCOUNTS.find(
        (a) => a.username === rawIdentifier || a.email === rawIdentifier
      );
      const expectedPassword = process.env.MOVISH_DEFAULT_PASSWORD || "Movish@2026";
      if (matched && password === expectedPassword) {
        const token = createSessionToken({
          userId: `builtin-${matched.username}`,
          email: matched.email,
          name: matched.name,
          roleCode: matched.roleCode,
          roleName: matched.roleName,
          employeeId: null,
        });
        await setSessionCookie(token);
        return NextResponse.json({
          user: {
            userId: `builtin-${matched.username}`,
            email: matched.email,
            name: matched.name,
            roleCode: matched.roleCode,
            roleName: matched.roleName,
            employeeId: null,
          },
        });
      }
    }

    return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
