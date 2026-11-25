import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "settings:manage")) {
      return NextResponse.json({ error: "Forbidden: Administration permission required" }, { status: 403 });
    }

    const [settings, users, roles, permissions, leadSources, locations, auditLogs] = await Promise.all([
      prisma.systemSetting.findMany(),
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.role.findMany({
        include: {
          permissions: { include: { permission: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] }),
      prisma.leadSource.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.location.findMany({ orderBy: [{ district: "asc" }, { city: "asc" }] }),
      prisma.auditLog.findMany({ take: 60, orderBy: { createdAt: "desc" } }),
    ]);

    const parsedSettings = Object.fromEntries(
      settings.map((s) => [s.key, JSON.parse(s.valueJson)])
    );

    return NextResponse.json({
      settings: parsedSettings,
      users,
      roles,
      permissions,
      leadSources,
      locations,
      auditLogs: canPerform(session, "audit:view") ? auditLogs : [],
      canViewAudit: canPerform(session, "audit:view"),
    });
  } catch (err) {
    console.error("Settings GET error:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "settings:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "update_setting") {
      const key = String(body.key);
      const category = String(body.category || "Configuration");
      const valueJson = JSON.stringify(body.value);

      const updated = await prisma.systemSetting.upsert({
        where: { key },
        update: { valueJson, category },
        create: { key, category, valueJson },
      });

      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "SETTING_UPDATED",
        entityType: "SystemSetting",
        entityId: updated.id,
        summary: `Updated configuration '${key}'`,
      });
      return NextResponse.json({ setting: updated });
    }

    if (action === "toggle_permission") {
      const roleId = String(body.roleId);
      const permissionId = String(body.permissionId);
      const allowed = Boolean(body.allowed);

      const rp = await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: { allowed },
        create: { roleId, permissionId, allowed },
      });

      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "PERMISSION_UPDATED",
        entityType: "RolePermission",
        entityId: rp.id,
        summary: `Set role permission allowed=${allowed}`,
      });
      return NextResponse.json({ rolePermission: rp });
    }

    if (action === "toggle_user") {
      const user = await prisma.user.update({
        where: { id: String(body.userId) },
        data: {
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
          ...(body.roleId ? { roleId: String(body.roleId) } : {}),
        },
      });
      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: user.id,
        summary: `Updated user ${user.email}`,
      });
      return NextResponse.json({ user });
    }

    if (action === "create_user") {
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim();
      const password = String(body.password || "Movish@2026");
      const roleId = String(body.roleId || "");
      if (!email || !name || !roleId) {
        return NextResponse.json({ error: "Name, email, and role are required." }, { status: 400 });
      }
      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: hashPassword(password),
          roleId,
          isActive: true,
        },
      });
      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        summary: `Created user login ${user.email}`,
      });
      return NextResponse.json({ user }, { status: 201 });
    }

    if (action === "add_location") {
      const loc = await prisma.location.create({
        data: {
          state: "Gujarat",
          district: String(body.district),
          city: String(body.city),
          area: body.area || null,
          pinCode: String(body.pinCode || "380001"),
          isServiceable: true,
          yardLocation: body.yardLocation || "Movish Yard 1 — Naroda",
        },
      });
      return NextResponse.json({ location: loc }, { status: 201 });
    }

    if (action === "toggle_source") {
      const src = await prisma.leadSource.update({
        where: { id: String(body.sourceId) },
        data: { isActive: Boolean(body.isActive) },
      });
      return NextResponse.json({ source: src });
    }

    return NextResponse.json({ error: "Unsupported settings action" }, { status: 400 });
  } catch (err) {
    console.error("Settings PATCH error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
