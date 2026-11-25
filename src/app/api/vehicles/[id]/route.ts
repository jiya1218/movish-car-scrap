import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { createNotification, logAudit } from "@/lib/audit";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "quotation_status") {
      if (body.approvalStatus && !canPerform(session, "quotations:approve")) {
        return NextResponse.json({ error: "Forbidden: Manager/Admin approval required" }, { status: 403 });
      }
      const qt = await prisma.quotation.update({
        where: { id },
        data: {
          ...(body.approvalStatus ? { approvalStatus: String(body.approvalStatus), approvedById: session.employeeId } : {}),
          ...(body.customerAcceptanceStatus ? { customerAcceptanceStatus: String(body.customerAcceptanceStatus) } : {}),
          ...(body.negotiationNotes !== undefined ? { negotiationNotes: String(body.negotiationNotes) } : {}),
        },
        include: { vehicle: true },
      });

      if (body.customerAcceptanceStatus === "Accepted") {
        await prisma.vehicle.update({ where: { id: qt.vehicleId }, data: { purchaseStatus: "Confirmed" } });
        if (qt.leadId) {
          await prisma.lead.update({ where: { id: qt.leadId }, data: { status: "Deal Confirmed", quotationAmount: qt.offeredPurchasePrice } });
        }
        await createNotification({
          title: `Quotation Accepted (${qt.quotationCode})`,
          description: `Customer accepted ₹${qt.offeredPurchasePrice} for ${qt.vehicle.registrationNumber}`,
          category: "Quotation accepted",
          relatedModule: "vehicles",
          relatedRecordId: qt.vehicleId,
        });
      }

      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "QUOTATION_UPDATED",
        entityType: "Quotation",
        entityId: qt.id,
        summary: `Updated quotation ${qt.quotationCode}`,
      });
      return NextResponse.json({ quotation: qt });
    }

    if (action === "pickup_status") {
      if (!canPerform(session, "vehicles:manage")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const nextStatus = String(body.pickupStatus);
      const pickup = await prisma.pickup.update({
        where: { id },
        data: {
          pickupStatus: nextStatus,
          ...(nextStatus === "Collected" ? { actualPickupDate: new Date() } : {}),
          ...(body.pickupExpenses !== undefined ? { pickupExpenses: Number(body.pickupExpenses) } : {}),
          ...(body.remarks !== undefined ? { remarks: String(body.remarks) } : {}),
        },
        include: { vehicle: true },
      });

      if (nextStatus === "Collected") {
        // Explicit PRD Rule 10.6: Do NOT assume collected vehicle has completed legal scrapping formalities!
        await prisma.vehicle.update({
          where: { id: pickup.vehicleId },
          data: { purchaseStatus: "Collected", documentVerificationStatus: "In Review" },
        });
        if (pickup.vehicle.leadId) {
          await prisma.lead.update({ where: { id: pickup.vehicle.leadId }, data: { status: "Vehicle Collected" } });
        }

        const existingInv = await prisma.inventory.findUnique({ where: { vehicleId: pickup.vehicleId } });
        if (!existingInv) {
          const invCount = await prisma.inventory.count();
          await prisma.inventory.create({
            data: {
              inventoryCode: `INV-${String(invCount + 1).padStart(4, "0")}`,
              vehicleId: pickup.vehicleId,
              collectionDate: new Date(),
              currentLocation: `Movish Yard — ${pickup.city}`,
              storageLocation: `Bay-${(invCount % 12) + 1}`,
              processingStatus: "Awaiting Documentation",
              estimatedValue: 45000,
              actualRealizationValue: 0,
            },
          });
        }

        await createNotification({
          title: `Vehicle Collected (${pickup.vehicle.registrationNumber})`,
          description: `Collected in ${pickup.city}; legal scrapping documentation verification required.`,
          category: "Vehicle collected",
          relatedModule: "vehicles",
          relatedRecordId: pickup.vehicleId,
        });
      }

      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "PICKUP_STATUS_UPDATED",
        entityType: "Pickup",
        entityId: pickup.id,
        summary: `Updated pickup ${pickup.pickupCode} to ${nextStatus}`,
      });
      return NextResponse.json({ pickup });
    }

    if (action === "document_verify") {
      if (!canPerform(session, "vehicles:manage")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const doc = await prisma.document.update({
        where: { id },
        data: {
          verificationStatus: String(body.verificationStatus),
          verificationRemarks: body.verificationRemarks !== undefined ? String(body.verificationRemarks) : undefined,
        },
      });
      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "DOCUMENT_VERIFIED",
        entityType: "Document",
        entityId: doc.id,
        summary: `Marked ${doc.documentType} (${doc.documentCode}) as ${doc.verificationStatus}`,
      });
      return NextResponse.json({ document: doc });
    }

    if (action === "inventory_status") {
      if (!canPerform(session, "vehicles:manage")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const inv = await prisma.inventory.update({
        where: { id },
        data: {
          processingStatus: String(body.processingStatus),
          ...(body.storageLocation ? { storageLocation: String(body.storageLocation) } : {}),
          ...(body.actualRealizationValue !== undefined ? { actualRealizationValue: Number(body.actualRealizationValue) } : {}),
        },
      });
      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "INVENTORY_UPDATED",
        entityType: "Inventory",
        entityId: inv.id,
        summary: `Updated yard inventory ${inv.inventoryCode} to ${inv.processingStatus}`,
      });
      return NextResponse.json({ inventory: inv });
    }

    return NextResponse.json({ error: "Unknown PATCH action" }, { status: 400 });
  } catch (err) {
    console.error("Vehicles PATCH error:", err);
    return NextResponse.json({ error: "Failed to update vehicle record" }, { status: 500 });
  }
}
