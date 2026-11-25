import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "followups:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const existing = await prisma.followUp.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!existing) return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });

    const body = await req.json();
    const status = String(body.status || "Completed");

    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        status,
        contactResult: body.contactResult ? String(body.contactResult) : existing.contactResult,
        customerResponse: body.customerResponse ? String(body.customerResponse) : existing.customerResponse,
        notes: body.notes !== undefined ? String(body.notes) : existing.notes,
        nextAction: body.nextAction ? String(body.nextAction) : existing.nextAction,
        nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : existing.nextFollowUpDate,
        completedAt: status === "Completed" ? new Date() : existing.completedAt,
      },
    });

    if (status === "Completed") {
      const nextLeadStatus = body.updatedLeadStatus ? String(body.updatedLeadStatus) : existing.lead.status;
      await prisma.lead.update({
        where: { id: existing.leadId },
        data: {
          lastContactAt: new Date(),
          status: nextLeadStatus,
          ...(body.nextFollowUpDate ? { nextFollowUpAt: new Date(body.nextFollowUpDate) } : {}),
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: existing.leadId,
          activityType: "Follow-up Completed",
          oldStatus: existing.lead.status,
          newStatus: nextLeadStatus,
          summary: `${existing.type} completed: ${body.contactResult || "Contacted"}. ${body.customerResponse || ""}`,
          performedById: session.employeeId,
        },
      });

      await prisma.communicationLog.create({
        data: {
          commCode: `COM-${Date.now().toString().slice(-6)}`,
          customerId: existing.customerId,
          leadId: existing.leadId,
          communicationType: existing.type === "WhatsApp message" ? "WhatsApp" : "Phone call",
          direction: "Outbound",
          employeeId: session.employeeId,
          summary: body.customerResponse || body.notes || `Completed ${existing.type}`,
          outcome: body.contactResult || "Completed",
          nextAction: body.nextAction || null,
        },
      });

      // Optionally schedule next follow-up automatically when nextFollowUpDate provided
      if (body.nextFollowUpDate) {
        const fuCount = await prisma.followUp.count();
        await prisma.followUp.create({
          data: {
            followUpCode: `FU-${String(fuCount + 1).padStart(4, "0")}`,
            leadId: existing.leadId,
            customerId: existing.customerId,
            assignedEmployeeId: existing.assignedEmployeeId,
            followUpDate: new Date(body.nextFollowUpDate),
            followUpTime: "11:00",
            type: body.nextFollowUpType || existing.type,
            priority: existing.priority,
            status: "Pending",
            notes: body.nextAction || "Follow-up continuation",
          },
        });
      }
    }

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "FOLLOWUP_UPDATED",
      entityType: "FollowUp",
      entityId: id,
      summary: `Marked follow-up ${existing.followUpCode} as ${status}`,
    });

    return NextResponse.json({ followUp: updated });
  } catch (err) {
    console.error("Follow-up PATCH error:", err);
    return NextResponse.json({ error: "Failed to update follow-up" }, { status: 500 });
  }
}
