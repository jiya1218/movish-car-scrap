import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { safeDivide } from "@/lib/format";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "today";
    const employeeFilter = searchParams.get("employeeId") || "All";
    const typeFilter = searchParams.get("type") || "All";
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const viewAll = canPerform(session, "leads:view_all");
    const empScope = !viewAll && session.employeeId ? { assignedEmployeeId: session.employeeId } : {};

    const [followUps, activeLeads, employees] = await Promise.all([
      prisma.followUp.findMany({
        where: {
          ...empScope,
          ...(employeeFilter !== "All" ? { assignedEmployeeId: employeeFilter } : {}),
          ...(typeFilter !== "All" ? { type: typeFilter } : {}),
        },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              status: true,
              priority: true,
              enquiryDate: true,
              lastContactAt: true,
              vehicles: { select: { manufacturer: true, model: true, registrationNumber: true } },
            },
          },
          customer: { select: { id: true, name: true, primaryMobile: true, city: true, district: true } },
          assignedEmployee: { select: { id: true, fullName: true } },
        },
        orderBy: { followUpDate: "asc" },
      }),
      prisma.lead.findMany({
        where: {
          isDeleted: false,
          status: { notIn: ["Completed", "Lost"] },
          ...empScope,
        },
        include: {
          customer: { select: { id: true, name: true, primaryMobile: true, city: true } },
          assignedEmployee: { select: { id: true, fullName: true } },
          followUps: { where: { status: "Pending" } },
        },
      }),
      prisma.employee.findMany({
        where: { accountStatus: "Active" },
        select: { id: true, fullName: true, assignedCity: true },
        orderBy: { fullName: "asc" },
      }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const categorized = followUps.map((f) => {
      const isOverdue = f.status === "Pending" && f.followUpDate < todayStart;
      const isToday = f.status === "Pending" && f.followUpDate >= todayStart && f.followUpDate <= todayEnd;
      const isUpcoming = f.status === "Pending" && f.followUpDate > todayEnd;
      return {
        ...f,
        bucket:
          f.status === "Completed"
            ? "completed"
            : f.status === "Missed"
            ? "missed"
            : isOverdue
            ? "overdue"
            : isToday
            ? "today"
            : isUpcoming
            ? "upcoming"
            : "all",
      };
    });

    const filtered = categorized.filter((f) => {
      if (tab !== "all" && tab !== "no_followup" && f.bucket !== tab) return false;
      if (search) {
        const hay = `${f.followUpCode} ${f.lead.leadCode} ${f.customer.name} ${f.customer.primaryMobile} ${f.customer.city} ${f.assignedEmployee.fullName} ${f.type}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const leadsWithoutFollowup = activeLeads.filter((l) => l.followUps.length === 0);

    const totalFu = followUps.length;
    const completedFu = followUps.filter((f) => f.status === "Completed").length;
    const overdueFu = categorized.filter((f) => f.bucket === "overdue").length;
    const todayFu = categorized.filter((f) => f.bucket === "today").length;
    const upcomingFu = categorized.filter((f) => f.bucket === "upcoming").length;
    const missedFu = followUps.filter((f) => f.status === "Missed").length;

    // Average first response time in hours across active leads with lastContactAt
    const responseHours = activeLeads
      .filter((l) => l.lastContactAt)
      .map((l) => Math.max(0.2, (l.lastContactAt!.getTime() - l.enquiryDate.getTime()) / 3600000));
    const avgResponseHours =
      responseHours.length > 0
        ? Number((responseHours.reduce((a, b) => a + b, 0) / responseHours.length).toFixed(1))
        : 0;

    return NextResponse.json({
      followUps: filtered,
      leadsWithoutFollowup,
      allActiveLeads: activeLeads.map((l) => ({
        id: l.id,
        leadCode: l.leadCode,
        status: l.status,
        customerName: l.customer.name,
        assignedEmployeeId: l.assignedEmployee?.id ?? null,
      })),
      metrics: {
        total: totalFu,
        today: todayFu,
        upcoming: upcomingFu,
        overdue: overdueFu,
        completed: completedFu,
        missed: missedFu,
        noFollowUpCount: leadsWithoutFollowup.length,
        completionRate: Number((safeDivide(completedFu, totalFu) * 100).toFixed(1)),
        avgResponseHours,
      },
      employees,
    });
  } catch (err) {
    console.error("Follow-ups GET error:", err);
    return NextResponse.json({ error: "Failed to load follow-ups" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "followups:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const leadId = String(body.leadId ?? "");
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const assignedEmployeeId = String(body.assignedEmployeeId || lead.assignedEmployeeId || session.employeeId || "");
    if (!assignedEmployeeId) {
      return NextResponse.json({ error: "Assigned employee is required." }, { status: 400 });
    }

    const fuCount = await prisma.followUp.count();
    const followUpDate = new Date(body.followUpDate || new Date());

    const fu = await prisma.followUp.create({
      data: {
        followUpCode: `FU-${String(fuCount + 1).padStart(4, "0")}`,
        leadId: lead.id,
        customerId: lead.customerId,
        assignedEmployeeId,
        followUpDate,
        followUpTime: String(body.followUpTime || "11:00"),
        type: String(body.type || "Phone call"),
        priority: String(body.priority || "Medium"),
        status: "Pending",
        notes: body.notes ? String(body.notes) : null,
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { nextFollowUpAt: followUpDate },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: "Follow-up Scheduled",
        summary: `Scheduled ${fu.type} for ${followUpDate.toLocaleDateString("en-IN")} at ${fu.followUpTime}`,
        performedById: session.employeeId,
      },
    });

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "FOLLOWUP_CREATED",
      entityType: "FollowUp",
      entityId: fu.id,
      summary: `Scheduled follow-up ${fu.followUpCode} for ${lead.leadCode}`,
    });

    return NextResponse.json({ followUp: fu }, { status: 201 });
  } catch (err) {
    console.error("Follow-ups POST error:", err);
    return NextResponse.json({ error: "Failed to create follow-up" }, { status: 500 });
  }
}
