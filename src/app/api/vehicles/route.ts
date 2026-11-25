import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { createNotification, logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "vehicles:view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const district = searchParams.get("district") || "All";
    const status = searchParams.get("status") || "All";

    const [vehicles, inspections, quotations, pickups, documents, inventory, employees, customers] = await Promise.all([
      prisma.vehicle.findMany({
        include: {
          customer: { select: { id: true, customerCode: true, name: true, primaryMobile: true, city: true, district: true } },
          lead: { select: { id: true, leadCode: true, status: true } },
          inspections: { orderBy: { inspectionDate: "desc" } },
          quotations: { orderBy: { revisionNumber: "desc" } },
          pickups: { orderBy: { createdAt: "desc" } },
          documents: true,
          inventory: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.inspection.findMany({
        include: {
          vehicle: { select: { id: true, vehicleCode: true, registrationNumber: true, manufacturer: true, model: true, locationCity: true } },
          inspector: { select: { fullName: true } },
        },
        orderBy: { inspectionDate: "desc" },
      }),
      prisma.quotation.findMany({
        include: {
          vehicle: { select: { id: true, vehicleCode: true, registrationNumber: true, manufacturer: true, model: true } },
          customer: { select: { name: true, primaryMobile: true, city: true } },
          preparedBy: { select: { fullName: true } },
          approvedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.pickup.findMany({
        include: {
          vehicle: { select: { id: true, vehicleCode: true, registrationNumber: true, manufacturer: true, model: true } },
          customer: { select: { name: true, primaryMobile: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.document.findMany({
        include: {
          vehicle: { select: { id: true, vehicleCode: true, registrationNumber: true, manufacturer: true, model: true, purchaseStatus: true } },
          uploadedBy: { select: { fullName: true } },
        },
        orderBy: { uploadDate: "desc" },
      }),
      prisma.inventory.findMany({
        include: {
          vehicle: { select: { id: true, vehicleCode: true, registrationNumber: true, manufacturer: true, model: true, category: true, locationCity: true } },
        },
        orderBy: { collectionDate: "desc" },
      }),
      prisma.employee.findMany({ where: { accountStatus: "Active" }, select: { id: true, fullName: true } }),
      prisma.customer.findMany({ select: { id: true, name: true, primaryMobile: true, district: true, city: true }, orderBy: { name: "asc" } }),
    ]);

    const filteredVehicles = vehicles.filter((v) => {
      if (district !== "All" && v.locationDistrict !== district) return false;
      if (status !== "All" && v.purchaseStatus !== status) return false;
      if (search) {
        const hay = `${v.vehicleCode} ${v.registrationNumber} ${v.manufacturer} ${v.model} ${v.customer.name} ${v.locationCity}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    return NextResponse.json({
      vehicles: filteredVehicles,
      inspections,
      quotations,
      pickups,
      documents,
      inventory,
      options: { employees, customers },
    });
  } catch (err) {
    console.error("Vehicles GET error:", err);
    return NextResponse.json({ error: "Failed to load vehicle records" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const action = String(body.action || "create_vehicle");

    if (action === "create_vehicle") {
      if (!canPerform(session, "vehicles:manage") && !canPerform(session, "leads:edit")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const count = await prisma.vehicle.count();
      const cust = await prisma.customer.findUnique({ where: { id: String(body.customerId) } });
      if (!cust) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

      const vehicle = await prisma.vehicle.create({
        data: {
          vehicleCode: `VEH-${String(count + 1).padStart(4, "0")}`,
          customerId: cust.id,
          leadId: body.leadId || null,
          registrationNumber: String(body.registrationNumber).toUpperCase(),
          manufacturer: String(body.manufacturer),
          model: String(body.model),
          variant: body.variant || null,
          manufacturingYear: Number(body.manufacturingYear || 2010),
          category: String(body.category || "Hatchback"),
          fuelType: String(body.fuelType || "Petrol"),
          vehicleCondition: String(body.vehicleCondition || "Fair"),
          runningCondition: String(body.runningCondition || "Running"),
          locationState: "Gujarat",
          locationDistrict: String(body.locationDistrict || cust.district),
          locationCity: String(body.locationCity || cust.city),
          ownershipDetails: String(body.ownershipDetails || "1st Owner"),
          rcAvailable: String(body.rcAvailable || "Yes"),
          additionalDetails: body.additionalDetails || null,
        },
      });
      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "VEHICLE_CREATED",
        entityType: "Vehicle",
        entityId: vehicle.id,
        summary: `Registered vehicle ${vehicle.vehicleCode} (${vehicle.registrationNumber})`,
      });
      return NextResponse.json({ vehicle }, { status: 201 });
    }

    if (action === "create_inspection") {
      if (!canPerform(session, "vehicles:manage")) {
        return NextResponse.json({ error: "Forbidden: Operations permission required" }, { status: 403 });
      }
      const inspectorId =
        String(body.inspectorId || session.employeeId || "") ||
        (await prisma.employee.findFirst({ where: { accountStatus: "Active" }, select: { id: true } }))?.id;
      if (!inspectorId) {
        return NextResponse.json({ error: "No active employee found for inspection." }, { status: 400 });
      }
      const count = await prisma.inspection.count();
      const inspection = await prisma.inspection.create({
        data: {
          inspectionCode: `INSP-${String(count + 1).padStart(4, "0")}`,
          vehicleId: String(body.vehicleId),
          inspectorId,
          vehicleCondition: String(body.vehicleCondition || "Fair"),
          engineCondition: String(body.engineCondition || "Average"),
          bodyCondition: String(body.bodyCondition || "Minor Rust"),
          tyreCondition: String(body.tyreCondition || "Worn"),
          batteryCondition: String(body.batteryCondition || "Dead"),
          accidentHistory: body.accidentHistory || null,
          estimatedPurchaseValue: Number(body.estimatedPurchaseValue || 0),
          notes: body.notes || null,
          result: String(body.result || "Eligible"),
        },
      });
      await prisma.vehicle.update({
        where: { id: String(body.vehicleId) },
        data: { purchaseStatus: "Inspected" },
      });
      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "INSPECTION_CREATED",
        entityType: "Inspection",
        entityId: inspection.id,
        summary: `Logged inspection ${inspection.inspectionCode} (Est. ₹${inspection.estimatedPurchaseValue})`,
      });
      return NextResponse.json({ inspection }, { status: 201 });
    }

    if (action === "create_quotation") {
      if (!canPerform(session, "quotations:create")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const vehicle = await prisma.vehicle.findUnique({ where: { id: String(body.vehicleId) } });
      if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

      const existingQuotes = await prisma.quotation.count({ where: { vehicleId: vehicle.id } });
      const totalQuotes = await prisma.quotation.count();
      const autoApprove = canPerform(session, "quotations:approve");
      const preparerId =
        session.employeeId ||
        (await prisma.employee.findFirst({ where: { accountStatus: "Active" }, select: { id: true } }))?.id;
      if (!preparerId) return NextResponse.json({ error: "No active employee found to prepare quotation." }, { status: 400 });

      const quotation = await prisma.quotation.create({
        data: {
          quotationCode: `QT-${String(totalQuotes + 1).padStart(4, "0")}`,
          vehicleId: vehicle.id,
          leadId: vehicle.leadId,
          customerId: vehicle.customerId,
          revisionNumber: existingQuotes + 1,
          offeredPurchasePrice: Number(body.offeredPurchasePrice),
          validityDate: new Date(body.validityDate || Date.now() + 14 * 86400000),
          preparedById: preparerId,
          approvalStatus: autoApprove ? "Approved" : "Pending Approval",
          approvedById: autoApprove ? preparerId : null,
          customerAcceptanceStatus: "Pending",
          negotiationNotes: body.negotiationNotes || null,
        },
      });

      await prisma.vehicle.update({ where: { id: vehicle.id }, data: { purchaseStatus: "Quoted" } });
      if (vehicle.leadId) {
        await prisma.lead.update({
          where: { id: vehicle.leadId },
          data: { quotationAmount: quotation.offeredPurchasePrice, status: "Quotation Given" },
        });
      }

      await createNotification({
        title: `Quotation ${quotation.quotationCode} Created`,
        description: `Rev #${quotation.revisionNumber} for ${vehicle.registrationNumber} at ₹${quotation.offeredPurchasePrice}`,
        category: "Quotation generated",
        relatedModule: "vehicles",
        relatedRecordId: vehicle.id,
        targetRoleCode: "MANAGER",
      });

      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "QUOTATION_CREATED",
        entityType: "Quotation",
        entityId: quotation.id,
        summary: `Created quotation ${quotation.quotationCode} (Rev #${quotation.revisionNumber})`,
      });
      return NextResponse.json({ quotation }, { status: 201 });
    }

    if (action === "create_pickup") {
      if (!canPerform(session, "vehicles:manage")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const vehicle = await prisma.vehicle.findUnique({ where: { id: String(body.vehicleId) } });
      if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

      const count = await prisma.pickup.count();
      const pickup = await prisma.pickup.create({
        data: {
          pickupCode: `PKP-${String(count + 1).padStart(4, "0")}`,
          vehicleId: vehicle.id,
          customerId: vehicle.customerId,
          pickupAddress: String(body.pickupAddress),
          district: String(body.district || vehicle.locationDistrict),
          city: String(body.city || vehicle.locationCity),
          scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : new Date(),
          scheduledTime: String(body.scheduledTime || "11:00 AM"),
          assignedDriver: body.assignedDriver || null,
          assignedVendor: body.assignedVendor || "Movish In-House Flatbed",
          transportationDetails: body.transportationDetails || "Flatbed Recovery Truck",
          pickupStatus: String(body.pickupStatus || "Scheduled"),
          pickupExpenses: Number(body.pickupExpenses || 0),
          remarks: body.remarks || null,
        },
      });
      if (vehicle.leadId && pickup.pickupStatus === "Scheduled") {
        await prisma.lead.update({ where: { id: vehicle.leadId }, data: { status: "Pickup Scheduled" } });
      }
      await createNotification({
        title: `Pickup Scheduled (${pickup.pickupCode})`,
        description: `${vehicle.registrationNumber} pickup in ${pickup.city}`,
        category: "Pickup scheduled",
        relatedModule: "vehicles",
        relatedRecordId: vehicle.id,
      });
      return NextResponse.json({ pickup }, { status: 201 });
    }

    if (action === "upload_document") {
      if (!canPerform(session, "vehicles:manage")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const count = await prisma.document.count();
      const doc = await prisma.document.create({
        data: {
          documentCode: `DOC-${String(count + 1).padStart(4, "0")}`,
          vehicleId: String(body.vehicleId),
          documentType: String(body.documentType),
          fileName: String(body.fileName),
          fileReference: `/uploads/${String(body.fileName)}`,
          uploadedById: session.employeeId,
          verificationStatus: String(body.verificationStatus || "Pending"),
          verificationRemarks: body.verificationRemarks || null,
        },
      });
      return NextResponse.json({ document: doc }, { status: 201 });
    }

    return NextResponse.json({ error: "Unsupported vehicle action" }, { status: 400 });
  } catch (err) {
    console.error("Vehicles POST error:", err);
    return NextResponse.json({ error: "Failed to process vehicle operation" }, { status: 500 });
  }
}
