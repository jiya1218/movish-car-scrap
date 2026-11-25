import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "leads:merge")) {
      return NextResponse.json({ error: "Forbidden: cannot merge leads" }, { status: 403 });
    }

    const body = await req.json();
    const primaryLeadId = String(body.primaryLeadId ?? "");
    const duplicateLeadId = String(body.duplicateLeadId ?? "");

    if (!primaryLeadId || !duplicateLeadId || primaryLeadId === duplicateLeadId) {
      return NextResponse.json({ error: "Select two distinct leads to merge." }, { status: 400 });
    }

    const [primary, duplicate] = await Promise.all([
      prisma.lead.findUnique({ where: { id: primaryLeadId }, include: { leadSource: true, campaign: true } }),
      prisma.lead.findUnique({ where: { id: duplicateLeadId }, include: { leadSource: true, campaign: true } }),
    ]);

    if (!primary || !duplicate || primary.isDeleted || duplicate.isDeleted) {
      return NextResponse.json({ error: "Leads not found for merge." }, { status: 404 });
    }

    // Re-link child records while preserving original first-touch & latest last-touch marketing attribution
    await prisma.$transaction([
      prisma.leadActivity.updateMany({ where: { leadId: duplicate.id }, data: { leadId: primary.id } }),
      prisma.followUp.updateMany({ where: { leadId: duplicate.id }, data: { leadId: primary.id } }),
      prisma.vehicle.updateMany({ where: { leadId: duplicate.id }, data: { leadId: primary.id } }),
      prisma.communicationLog.updateMany({ where: { leadId: duplicate.id }, data: { leadId: primary.id } }),
      prisma.quotation.updateMany({ where: { leadId: duplicate.id }, data: { leadId: primary.id } }),
      prisma.lead.update({
        where: { id: primary.id },
        data: {
          lastTouchSource: duplicate.lastTouchSource || duplicate.leadSource.name,
          lastTouchCampaign: duplicate.lastTouchCampaign || duplicate.campaign?.name || primary.lastTouchCampaign,
          isDuplicate: false,
          internalRemarks: `${primary.internalRemarks ? primary.internalRemarks + "\n" : ""}Merged duplicate lead ${duplicate.leadCode} (preserved attribution).`,
        },
      }),
      prisma.lead.update({
        where: { id: duplicate.id },
        data: {
          mergedIntoLeadId: primary.id,
          isDeleted: true,
          deletedAt: new Date(),
          status: "Lost",
          lostReason: "Duplicate enquiry",
        },
      }),
      prisma.leadActivity.create({
        data: {
          leadId: primary.id,
          activityType: "Duplicate Merged",
          summary: `Merged duplicate enquiry ${duplicate.leadCode} into ${primary.leadCode}; historical activity and marketing attribution preserved.`,
          performedById: session.employeeId,
        },
      }),
    ]);

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "LEADS_MERGED",
      entityType: "Lead",
      entityId: primary.id,
      summary: `Merged duplicate ${duplicate.leadCode} into ${primary.leadCode}`,
    });

    return NextResponse.json({ ok: true, primaryLeadId: primary.id });
  } catch (err) {
    console.error("Lead merge error:", err);
    return NextResponse.json({ error: "Failed to merge leads" }, { status: 500 });
  }
}
