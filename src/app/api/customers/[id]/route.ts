import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        leads: {
          where: { isDeleted: false },
          include: {
            leadSource: true,
            campaign: { select: { name: true } },
            assignedEmployee: { select: { fullName: true } },
          },
          orderBy: { enquiryDate: "desc" },
        },
        vehicles: {
          include: {
            inspections: true,
            quotations: true,
            pickups: true,
            documents: true,
          },
          orderBy: { createdAt: "desc" },
        },
        transactions: {
          include: { vehicle: { select: { vehicleCode: true, registrationNumber: true, model: true } } },
          orderBy: { transactionDate: "desc" },
        },
        communicationLogs: {
          include: { employee: { select: { fullName: true } } },
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const canViewFinance = canPerform(session, "finance:view");
    return NextResponse.json({
      customer: {
        ...customer,
        transactions: canViewFinance ? customer.transactions : [],
      },
    });
  } catch (err) {
    console.error("Customer detail error:", err);
    return NextResponse.json({ error: "Failed to load customer" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "customers:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(body.name ? { name: String(body.name) } : {}),
        ...(body.primaryMobile ? { primaryMobile: String(body.primaryMobile) } : {}),
        ...(body.altMobile !== undefined ? { altMobile: body.altMobile || null } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        ...(body.district ? { district: String(body.district) } : {}),
        ...(body.city ? { city: String(body.city) } : {}),
        ...(body.area !== undefined ? { area: body.area || null } : {}),
        ...(body.pinCode !== undefined ? { pinCode: body.pinCode || null } : {}),
        ...(body.fullAddress !== undefined ? { fullAddress: body.fullAddress || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      },
    });

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "CUSTOMER_UPDATED",
      entityType: "Customer",
      entityId: id,
      summary: `Updated customer profile ${updated.customerCode}`,
    });

    return NextResponse.json({ customer: updated });
  } catch (err) {
    console.error("Customer PATCH error:", err);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}
