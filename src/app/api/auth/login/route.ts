import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { RoleCode } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawIdentifier = String(body.identifier ?? body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!rawIdentifier || !password) {
      return NextResponse.json({ error: "Username/email and password are required." }, { status: 400 });
    }

    const user = rawIdentifier.includes("@")
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

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      roleCode: user.role.code as RoleCode,
      roleName: user.role.name,
      employeeId: user.employeeId,
    });

    await setSessionCookie(token);

    await logAudit({
      actorUserId: user.id,
      actorName: user.name,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      summary: `${user.name} (${user.role.name}) signed in.`,
    });

    return NextResponse.json({
      user: {
        userId: user.id,
        email: user.email,
        name: user.name,
        roleCode: user.role.code,
        roleName: user.role.name,
        employeeId: user.employeeId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}
