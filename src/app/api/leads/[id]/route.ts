import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { createNotification, logAudit } from "@/lib/audit";
import { evaluateLeadIntent } from "@/lib/scoring";
import { STAGE_INDEX } from "@/lib/constants";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "leads:view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        customer: true,
        leadSource: true,
        campaign: true,
        adSet: true,
        ad: true,
        assignedEmployee: true,
        vehicles: {
          include: {
            documents: true,
            inspections: { include: { inspector: { select: { fullName: true } } } },
            pickups: true,
          },
        },
        quotations: {
          include: { preparedBy: { select: { fullName: true } }, approvedBy: { select: { fullName: true } } },
          orderBy: { revisionNumber: "desc" },
        },
        followUps: {
          include: { assignedEmployee: { select: { fullName: true } } },
          orderBy: { followUpDate: "desc" },
        },
        activities: {
          include: { performedBy: { select: { fullName: true } } },
          orderBy: { createdAt: "desc" },
        },
        assignments: {
          include: {
            fromEmployee: { select: { fullName: true } },
            toEmployee: { select: { fullName: true } },
            assignedBy: { select: { fullName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        transactions: {
          include: { expenses: true, revenues: true, payments: true },
          orderBy: { transactionDate: "desc" },
        },
        communicationLogs: {
          include: { employee: { select: { fullName: true } } },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!lead || lead.isDeleted) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!canPerform(session, "leads:view_all") && session.employeeId && lead.assignedEmployeeId !== session.employeeId) {
      return NextResponse.json({ error: "Forbidden: lead not assigned to you" }, { status: 403 });
    }

    const v = lead.vehicles[0];
    const scoring = evaluateLeadIntent({
      respondedToFirstCall: Boolean(lead.lastContactAt),
      vehicleDetailsProvided: Boolean(v),
      district: lead.customer.district,
      rcAvailable: v?.rcAvailable ?? "No",
      status: lead.status,
      hasAcceptedOrNegotiatingQuote: lead.quotations.some((q) => ["Accepted", "Negotiating"].includes(q.customerAcceptanceStatus)),
      hasScheduledOrDoneInspection: Boolean(v && v.inspections.length > 0),
    });

    const canViewFinance = canPerform(session, "finance:view");

    return NextResponse.json({
      lead: {
        ...lead,
        transactions: canViewFinance ? lead.transactions : [],
      },
      scoring,
    });
  } catch (err) {
    console.error("Lead detail GET error:", err);
    return NextResponse.json({ error: "Failed to load lead profile" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "leads:edit") && !canPerform(session, "leads:assign")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const existing = await prisma.lead.findUnique({
      where: { id },
      include: { customer: true, vehicles: true },
    });

    if (!existing || existing.isDeleted) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await req.json();

    // Enforce lost reason (Section 7.6)
    if (body.status === "Lost" && !body.lostReason) {
      return NextResponse.json({ error: "A lost reason is mandatory when marking a lead Lost." }, { status: 400 });
    }

    const nextStatus = body.status ? String(body.status) : existing.status;
    const nextAssignee = body.assignedEmployeeId !== undefined ? body.assignedEmployeeId || null : existing.assignedEmployeeId;

    // Assignment check
    if (nextAssignee !== existing.assignedEmployeeId && !canPerform(session, "leads:assign")) {
      return NextResponse.json({ error: "Forbidden: you cannot reassign leads" }, { status: 403 });
    }

    const stageIdx = STAGE_INDEX[nextStatus] ?? 0;
    const qualificationStatus =
      body.qualificationStatus ??
      (nextStatus === "Lost"
        ? "Disqualified"
        : stageIdx >= 4
        ? "Qualified"
        : existing.qualificationStatus);

    const v = existing.vehicles[0];
    const scoring = evaluateLeadIntent({
      respondedToFirstCall: Boolean(existing.lastContactAt) || stageIdx >= 2,
      vehicleDetailsProvided: Boolean(v),
      district: existing.customer.district,
      rcAvailable: v?.rcAvailable ?? "Yes",
      status: nextStatus,
      hasAcceptedOrNegotiatingQuote: ["Negotiation", "Deal Confirmed"].includes(nextStatus),
      hasScheduledOrDoneInspection: stageIdx >= 5,
    });

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: nextStatus,
        lostReason: nextStatus === "Lost" ? String(body.lostReason) : body.status ? null : existing.lostReason,
        priority: body.priority ? String(body.priority) : existing.priority,
        assignedEmployeeId: nextAssignee,
        assignedById: nextAssignee !== existing.assignedEmployeeId ? session.employeeId : existing.assignedById,
        qualificationStatus,
        expectedSellingPrice: body.expectedSellingPrice !== undefined ? Number(body.expectedSellingPrice) : existing.expectedSellingPrice,
        quotationAmount: body.quotationAmount !== undefined ? Number(body.quotationAmount) : existing.quotationAmount,
        customerNotes: body.customerNotes !== undefined ? String(body.customerNotes) : existing.customerNotes,
        internalRemarks: body.internalRemarks !== undefined ? String(body.internalRemarks) : existing.internalRemarks,
        lastContactAt: stageIdx >= 2 && !existing.lastContactAt ? new Date() : existing.lastContactAt,
        intentScore: scoring.score,
        intentCategory: scoring.category,
      },
    });

    // Update customer contact / location if passed
    if (body.customerName || body.city || body.district || body.email !== undefined) {
      await prisma.customer.update({
        where: { id: existing.customerId },
        data: {
          ...(body.customerName ? { name: String(body.customerName) } : {}),
          ...(body.city ? { city: String(body.city) } : {}),
          ...(body.district ? { district: String(body.district) } : {}),
          ...(body.email !== undefined ? { email: body.email || null } : {}),
        },
      });
    }

    // Log status transition
    if (nextStatus !== existing.status) {
      await prisma.leadActivity.create({
        data: {
          leadId: id,
          activityType: "Status Change",
          oldStatus: existing.status,
          newStatus: nextStatus,
          summary: `Stage moved from ${existing.status} to ${nextStatus}${nextStatus === "Lost" ? ` (${body.lostReason})` : ""}`,
          performedById: session.employeeId,
        },
      });
    }

    // Log reassignment
    if (nextAssignee !== existing.assignedEmployeeId && nextAssignee) {
      await prisma.leadAssignment.create({
        data: {
          leadId: id,
          fromEmployeeId: existing.assignedEmployeeId,
          toEmployeeId: nextAssignee,
          assignedById: session.employeeId,
          reason: body.assignmentReason ? String(body.assignmentReason) : "Manual reassignment",
        },
      });
      await prisma.leadActivity.create({
        data: {
          leadId: id,
          activityType: "Lead Assignment",
          summary: `Lead reassigned to new sales representative`,
          performedById: session.employeeId,
        },
      });
      await createNotification({
        title: `Lead ${existing.leadCode} Assigned`,
        description: `${existing.customer.name} assigned by ${session.name}`,
        category: existing.assignedEmployeeId ? "Lead reassigned" : "New lead assigned",
        relatedModule: "leads",
        relatedRecordId: id,
      });
    }

    // Add manual note activity if supplied
    if (body.addNote) {
      await prisma.leadActivity.create({
        data: {
          leadId: id,
          activityType: "Note",
          summary: String(body.addNote),
          performedById: session.employeeId,
        },
      });
    }

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "LEAD_UPDATED",
      entityType: "Lead",
      entityId: id,
      summary: `Updated lead ${existing.leadCode} (Stage: ${nextStatus})`,
    });

    return NextResponse.json({ lead: updated });
  } catch (err) {
    console.error("Lead PATCH error:", err);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "leads:delete")) {
      return NextResponse.json({ error: "Forbidden: only authorized roles can delete leads" }, { status: 403 });
    }

    const { id } = await context.params;
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await prisma.lead.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "LEAD_SOFT_DELETED",
      entityType: "Lead",
      entityId: id,
      summary: `Soft-deleted lead ${existing.leadCode}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Lead DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
