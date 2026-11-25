import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { STAGE_INDEX } from "@/lib/constants";
import { safeDivide } from "@/lib/format";

export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "team:view")) {
      return NextResponse.json({ error: "Forbidden: Team management is restricted for your role" }, { status: 403 });
    }

    const [employees, activities, roles] = await Promise.all([
      prisma.employee.findMany({
        include: {
          role: true,
          reportingManager: { select: { id: true, fullName: true } },
          assignedLeads: {
            where: { isDeleted: false },
            select: {
              id: true,
              status: true,
              qualificationStatus: true,
              enquiryDate: true,
              lastContactAt: true,
              vehicles: { select: { purchaseStatus: true } },
            },
          },
          followUps: { select: { id: true, status: true, followUpDate: true } },
          preparedQuotations: { select: { id: true } },
        },
        orderBy: { employeeCode: "asc" },
      }),
      prisma.leadActivity.findMany({
        take: 40,
        orderBy: { createdAt: "desc" },
        include: {
          lead: { select: { id: true, leadCode: true, customer: { select: { name: true } } } },
          performedBy: { select: { id: true, fullName: true, employeeCode: true } },
        },
      }),
      prisma.role.findMany({ orderBy: { name: "asc" } }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const enriched = employees.map((e) => {
      const leads = e.assignedLeads;
      const leadsAssigned = leads.length;
      const leadsContacted = leads.filter(
        (l) => (STAGE_INDEX[l.status] ?? 0) >= (STAGE_INDEX["Contacted"] ?? 2) && l.status !== "Lost"
      ).length;
      const interestedLeads = leads.filter(
        (l) => (STAGE_INDEX[l.status] ?? 0) >= (STAGE_INDEX["Interested"] ?? 3) && l.status !== "Lost"
      ).length;
      const qualifiedLeads = leads.filter((l) => l.qualificationStatus === "Qualified").length;
      const quotationsGiven = e.preparedQuotations.length;
      const dealsConfirmed = leads.filter(
        (l) => (STAGE_INDEX[l.status] ?? 0) >= (STAGE_INDEX["Deal Confirmed"] ?? 8) && l.status !== "Lost"
      ).length;
      const vehiclesCollected = leads.filter(
        (l) => (STAGE_INDEX[l.status] ?? 0) >= (STAGE_INDEX["Vehicle Collected"] ?? 10) && l.status !== "Lost"
      ).length;
      const completedTransactions = leads.filter((l) => l.status === "Completed").length;
      const followUpsCompleted = e.followUps.filter((f) => f.status === "Completed").length;
      const overdueFollowUps = e.followUps.filter(
        (f) => f.status === "Pending" && f.followUpDate < todayStart
      ).length;

      const respHours = leads
        .filter((l) => l.lastContactAt)
        .map((l) => Math.max(0.2, (l.lastContactAt!.getTime() - l.enquiryDate.getTime()) / 3600000));
      const avgResponseHours =
        respHours.length > 0
          ? Number((respHours.reduce((a, b) => a + b, 0) / respHours.length).toFixed(1))
          : 0;

      const conversionRate = Number((safeDivide(completedTransactions, leadsAssigned) * 100).toFixed(1));

      return {
        id: e.id,
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        mobile: e.mobile,
        email: e.email,
        roleId: e.roleId,
        roleCode: e.role.code,
        roleName: e.role.name,
        joiningDate: e.joiningDate,
        assignedDistrict: e.assignedDistrict,
        assignedCity: e.assignedCity,
        accountStatus: e.accountStatus,
        reportingManagerName: e.reportingManager?.fullName ?? "—",
        targets: {
          leadsContacted: e.monthlyLeadTarget,
          qualifiedLeads: e.monthlyQualifiedTarget,
          quotations: e.monthlyQuotationTarget,
          confirmedDeals: e.monthlyDealTarget,
          vehiclesCollected: e.monthlyPickupTarget,
          completedTransactions: e.monthlyCompletedTarget,
        },
        metrics: {
          leadsAssigned,
          leadsContacted,
          interestedLeads,
          qualifiedLeads,
          quotationsGiven,
          dealsConfirmed,
          vehiclesCollected,
          completedTransactions,
          followUpsCompleted,
          overdueFollowUps,
          avgResponseHours,
          conversionRate,
        },
      };
    });

    return NextResponse.json({
      employees: enriched,
      activityLogs: activities,
      roles,
    });
  } catch (err) {
    console.error("Team GET error:", err);
    return NextResponse.json({ error: "Failed to load team data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "team:manage") && !canPerform(session, "settings:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const mobile = String(body.mobile ?? "").trim();
    const roleId = String(body.roleId ?? "");

    if (!fullName || !email || !mobile || !roleId) {
      return NextResponse.json({ error: "Name, email, mobile, and role are required." }, { status: 400 });
    }

    const count = await prisma.employee.count();
    const emp = await prisma.employee.create({
      data: {
        employeeCode: `EMP-${String(count + 1).padStart(3, "0")}`,
        fullName,
        email,
        mobile,
        roleId,
        joiningDate: body.joiningDate ? new Date(body.joiningDate) : new Date(),
        assignedDistrict: String(body.assignedDistrict || "Ahmedabad"),
        assignedCity: String(body.assignedCity || "Ahmedabad"),
        accountStatus: "Active",
        monthlyLeadTarget: Number(body.monthlyLeadTarget || 25),
        monthlyQualifiedTarget: Number(body.monthlyQualifiedTarget || 12),
        monthlyQuotationTarget: Number(body.monthlyQuotationTarget || 10),
        monthlyDealTarget: Number(body.monthlyDealTarget || 6),
        monthlyPickupTarget: Number(body.monthlyPickupTarget || 6),
        monthlyCompletedTarget: Number(body.monthlyCompletedTarget || 5),
      },
    });

    if (body.createLoginAccount) {
      await prisma.user.create({
        data: {
          email,
          passwordHash: hashPassword(String(body.password || "Movish@2026")),
          name: fullName,
          roleId,
          employeeId: emp.id,
          isActive: true,
        },
      });
    }

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "EMPLOYEE_CREATED",
      entityType: "Employee",
      entityId: emp.id,
      summary: `Added employee ${emp.employeeCode} (${emp.fullName})`,
    });

    return NextResponse.json({ employee: emp }, { status: 201 });
  } catch (err) {
    console.error("Team POST error:", err);
    return NextResponse.json({ error: "Failed to add employee" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "team:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id ?? "");
    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(body.accountStatus ? { accountStatus: String(body.accountStatus) } : {}),
        ...(body.assignedDistrict ? { assignedDistrict: String(body.assignedDistrict) } : {}),
        ...(body.assignedCity ? { assignedCity: String(body.assignedCity) } : {}),
        ...(body.monthlyLeadTarget !== undefined ? { monthlyLeadTarget: Number(body.monthlyLeadTarget) } : {}),
        ...(body.monthlyQualifiedTarget !== undefined ? { monthlyQualifiedTarget: Number(body.monthlyQualifiedTarget) } : {}),
        ...(body.monthlyQuotationTarget !== undefined ? { monthlyQuotationTarget: Number(body.monthlyQuotationTarget) } : {}),
        ...(body.monthlyDealTarget !== undefined ? { monthlyDealTarget: Number(body.monthlyDealTarget) } : {}),
        ...(body.monthlyPickupTarget !== undefined ? { monthlyPickupTarget: Number(body.monthlyPickupTarget) } : {}),
        ...(body.monthlyCompletedTarget !== undefined ? { monthlyCompletedTarget: Number(body.monthlyCompletedTarget) } : {}),
      },
    });

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "EMPLOYEE_TARGETS_UPDATED",
      entityType: "Employee",
      entityId: updated.id,
      summary: `Updated targets / details for ${updated.fullName}`,
    });

    return NextResponse.json({ employee: updated });
  } catch (err) {
    console.error("Team PATCH error:", err);
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}
