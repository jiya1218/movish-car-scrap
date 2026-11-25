import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.allowedModules.includes("communication")) {
      return NextResponse.json({ error: "Forbidden: Communication module is restricted for your role" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "All";
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const viewAll = canPerform(session, "leads:view_all");
    const empScope = !viewAll && session.employeeId ? { employeeId: session.employeeId } : {};

    const [logs, whatsappSetting, customers, leads] = await Promise.all([
      prisma.communicationLog.findMany({
        where: {
          ...empScope,
          ...(type !== "All" ? { communicationType: type } : {}),
        },
        include: {
          customer: { select: { id: true, customerCode: true, name: true, primaryMobile: true, city: true } },
          lead: { select: { id: true, leadCode: true, status: true } },
          employee: { select: { id: true, fullName: true } },
        },
        orderBy: { timestamp: "desc" },
      }),
      prisma.systemSetting.findUnique({ where: { key: "whatsapp_integration" } }),
      prisma.customer.findMany({ select: { id: true, name: true, primaryMobile: true }, orderBy: { name: "asc" } }),
      prisma.lead.findMany({
        where: { isDeleted: false },
        select: { id: true, leadCode: true, customerId: true, customer: { select: { name: true } } },
        orderBy: { enquiryDate: "desc" },
        take: 100,
      }),
    ]);

    const filtered = logs.filter((l) => {
      if (!search) return true;
      const hay = `${l.commCode} ${l.customer.name} ${l.customer.primaryMobile} ${l.lead?.leadCode || ""} ${l.summary} ${l.communicationType}`.toLowerCase();
      return hay.includes(search);
    });

    return NextResponse.json({
      logs: filtered,
      whatsappStatus: whatsappSetting ? JSON.parse(whatsappSetting.valueJson) : { status: "Not Connected" },
      options: { customers, leads },
    });
  } catch (err) {
    console.error("Communication GET error:", err);
    return NextResponse.json({ error: "Failed to load communication logs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.allowedModules.includes("communication")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const customerId = String(body.customerId ?? "");
    if (!customerId || !body.summary) {
      return NextResponse.json({ error: "Customer and interaction summary are required." }, { status: 400 });
    }

    const count = await prisma.communicationLog.count();
    const log = await prisma.communicationLog.create({
      data: {
        commCode: `COM-${String(count + 1).padStart(4, "0")}`,
        customerId,
        leadId: body.leadId || null,
        communicationType: String(body.communicationType || "Phone call"),
        direction: String(body.direction || "Outbound"),
        employeeId: session.employeeId,
        summary: String(body.summary),
        outcome: body.outcome || null,
        nextAction: body.nextAction || null,
      },
    });

    if (body.leadId) {
      await prisma.lead.update({
        where: { id: String(body.leadId) },
        data: { lastContactAt: new Date() },
      });
      await prisma.leadActivity.create({
        data: {
          leadId: String(body.leadId),
          activityType: String(body.communicationType || "Communication"),
          summary: `${body.communicationType}: ${body.summary}`,
          performedById: session.employeeId,
        },
      });
    }

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "COMMUNICATION_LOGGED",
      entityType: "CommunicationLog",
      entityId: log.id,
      summary: `Logged ${log.communicationType} interaction (${log.commCode})`,
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (err) {
    console.error("Communication POST error:", err);
    return NextResponse.json({ error: "Failed to record interaction" }, { status: 500 });
  }
}
