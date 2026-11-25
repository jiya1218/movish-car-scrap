import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionContext,
  hasSwitchGrant,
  setSessionCookie,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { RoleCode } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const current = await getSessionContext();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorized =
      ["SUPER_ADMIN", "ADMIN"].includes(current.roleCode) || (await hasSwitchGrant());
    if (!authorized) {
      return NextResponse.json(
        { error: "Only Super Admin / Admin can switch operational roles." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const roleCode = String(body.roleCode ?? "").trim() as RoleCode;

    // Prefer switching to a real active user of that role if one exists; otherwise preview role using owner session
    const targetUser = await prisma.user.findFirst({
      where: { isActive: true, role: { code: roleCode } },
      include: { role: true },
    });

    if (targetUser) {
      const token = createSessionToken({
        userId: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        roleCode: targetUser.role.code as RoleCode,
        roleName: targetUser.role.name,
        employeeId: targetUser.employeeId,
      });
      await setSessionCookie(token);

      await logAudit({
        actorUserId: current.userId,
        actorName: current.name,
        action: "ROLE_SWITCH",
        entityType: "User",
        entityId: targetUser.id,
        summary: `Switched workspace to ${targetUser.role.name} (${targetUser.name}).`,
      });

      return NextResponse.json({ ok: true, roleCode: targetUser.role.code });
    }

    // No separate user exists for that role yet — issue preview token on the owner's user record
    const ownerUser = await prisma.user.findFirst({
      where: { isActive: true, role: { code: { in: ["SUPER_ADMIN", "ADMIN"] } } },
      include: { role: true },
    });
    const targetRole = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!ownerUser || !targetRole) {
      return NextResponse.json({ error: "Target role not found." }, { status: 404 });
    }

    const token = createSessionToken({
      userId: ownerUser.id,
      email: ownerUser.email,
      name: ownerUser.name,
      roleCode: ownerUser.role.code as RoleCode,
      roleName: ownerUser.role.name,
      employeeId: ownerUser.employeeId,
      previewRoleCode: roleCode,
    });
    await setSessionCookie(token);

    await logAudit({
      actorUserId: ownerUser.id,
      actorName: ownerUser.name,
      action: "ROLE_PREVIEW",
      entityType: "Role",
      entityId: targetRole.id,
      summary: `Switched workspace view to ${targetRole.name} (Preview).`,
    });

    return NextResponse.json({ ok: true, roleCode });
  } catch (err) {
    console.error("Role switch error:", err);
    return NextResponse.json({ error: "Unable to switch role." }, { status: 500 });
  }
}
