import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { createNotification, logAudit } from "@/lib/audit";
import { evaluateLeadIntent } from "@/lib/scoring";
import { STAGE_INDEX } from "@/lib/constants";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "leads:view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "all";
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const status = searchParams.get("status") || "All";
    const priority = searchParams.get("priority") || "All";
    const source = searchParams.get("source") || "All";
    const campaignId = searchParams.get("campaignId") || "All";
    const employeeId = searchParams.get("employeeId") || "All";
    const district = searchParams.get("district") || "All";
    const city = searchParams.get("city") || "All";
    const sortBy = searchParams.get("sortBy") || "enquiryDate";
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") || 25)));
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const viewAll = canPerform(session, "leads:view_all");
    const scopeFilter = !viewAll && session.employeeId ? { assignedEmployeeId: session.employeeId } : {};

    const leads = await prisma.lead.findMany({
      where: {
        isDeleted: false,
        ...scopeFilter,
        ...(fromParam || toParam
          ? {
              enquiryDate: {
                ...(fromParam ? { gte: new Date(fromParam) } : {}),
                ...(toParam ? { lte: new Date(toParam) } : {}),
              },
            }
          : {}),
      },
      include: {
        customer: true,
        leadSource: true,
        campaign: { select: { id: true, name: true, campaignCode: true } },
        adSet: { select: { id: true, name: true } },
        ad: { select: { id: true, name: true, platform: true } },
        assignedEmployee: { select: { id: true, fullName: true, employeeCode: true, assignedCity: true } },
        vehicles: {
          select: {
            id: true,
            vehicleCode: true,
            manufacturer: true,
            model: true,
            manufacturingYear: true,
            registrationNumber: true,
            fuelType: true,
            rcAvailable: true,
          },
        },
        followUps: { orderBy: { followUpDate: "desc" } },
      },
      orderBy: { enquiryDate: "desc" },
    });

    // Identify duplicate groups dynamically (mobile or vehicle registration collisions)
    const mobileCounts = new Map<string, string[]>();
    const regCounts = new Map<string, string[]>();
    for (const l of leads) {
      const m = l.customer.primaryMobile;
      mobileCounts.set(m, [...(mobileCounts.get(m) ?? []), l.id]);
      for (const v of l.vehicles) {
        const reg = v.registrationNumber.toUpperCase();
        regCounts.set(reg, [...(regCounts.get(reg) ?? []), l.id]);
      }
    }

    const now = Date.now();
    const staleMs = 3 * 86400000;

    const enriched = leads.map((l) => {
      const v = l.vehicles[0];
      const dupByMobile = (mobileCounts.get(l.customer.primaryMobile)?.length ?? 0) > 1;
      const dupByReg = v ? (regCounts.get(v.registrationNumber.toUpperCase())?.length ?? 0) > 1 : false;
      const detectedDuplicate = l.isDuplicate || dupByMobile || dupByReg;

      const hasMissedFu = l.followUps.some((f) => f.status === "Missed" || (f.status === "Pending" && f.followUpDate.getTime() < now));
      const noFirstResponse = !l.lastContactAt && l.status !== "Lost" && l.status !== "Completed" && now - l.enquiryDate.getTime() > 86400000;
      const staleContact = l.lastContactAt ? now - l.lastContactAt.getTime() > staleMs && !["Completed", "Lost"].includes(l.status) : false;
      const pendingQuotePostInsp = l.status === "Inspection Required";
      const longNegotiation = l.status === "Negotiation" && now - l.updatedAt.getTime() > 4 * 86400000;

      const recoveryReasons: string[] = [];
      if (noFirstResponse) recoveryReasons.push("No first response >24h");
      if (hasMissedFu) recoveryReasons.push("Missed / overdue follow-up");
      if (staleContact) recoveryReasons.push("No contact >3 days");
      if (pendingQuotePostInsp) recoveryReasons.push("Awaiting quotation post-inspection");
      if (longNegotiation) recoveryReasons.push("Stuck in negotiation");

      return {
        id: l.id,
        leadCode: l.leadCode,
        customerId: l.customerId,
        customerName: l.customer.name,
        mobile: l.customer.primaryMobile,
        altMobile: l.customer.altMobile,
        email: l.customer.email,
        city: l.customer.city,
        district: l.customer.district,
        pinCode: l.customer.pinCode,
        vehicleId: v?.id ?? null,
        vehicle: v ? `${v.manufacturer} ${v.model}` : "Not Added",
        manufacturer: v?.manufacturer ?? "",
        model: v?.model ?? "",
        manufacturingYear: v?.manufacturingYear ?? null,
        registrationNumber: v?.registrationNumber ?? "—",
        leadSource: l.leadSource.name,
        leadSourceId: l.leadSourceId,
        campaignId: l.campaignId,
        campaignName: l.campaign?.name ?? "Direct / Organic",
        adName: l.ad?.name ?? "—",
        platform: l.ad?.platform ?? l.firstTouchSource ?? l.leadSource.name,
        status: l.status,
        lostReason: l.lostReason,
        priority: l.priority,
        qualificationStatus: l.qualificationStatus,
        intentScore: l.intentScore,
        intentCategory: l.intentCategory,
        expectedSellingPrice: l.expectedSellingPrice,
        quotationAmount: l.quotationAmount,
        assignedEmployeeId: l.assignedEmployeeId,
        assignedEmployeeName: l.assignedEmployee?.fullName ?? "Unassigned",
        createdDate: l.enquiryDate,
        lastContact: l.lastContactAt,
        nextFollowUp: l.nextFollowUpAt,
        isDuplicate: detectedDuplicate,
        duplicateMatchReason: dupByMobile ? "Matching Mobile Number" : dupByReg ? "Matching Vehicle Reg." : l.isDuplicate ? "Flagged Duplicate" : null,
        needsRecovery: recoveryReasons.length > 0 && !["Completed", "Lost"].includes(l.status),
        recoveryReasons,
        customerNotes: l.customerNotes,
      };
    });

    // Apply view & filters
    const filtered = enriched.filter((row) => {
      if (view === "lost" && row.status !== "Lost") return false;
      if (view === "duplicates" && !row.isDuplicate) return false;
      if (view === "recovery" && !row.needsRecovery) return false;
      if (status !== "All" && row.status !== status) return false;
      if (priority !== "All" && row.priority !== priority) return false;
      if (source !== "All" && row.leadSource !== source) return false;
      if (campaignId !== "All" && row.campaignId !== campaignId) return false;
      if (employeeId === "unassigned" && row.assignedEmployeeId) return false;
      if (employeeId !== "All" && employeeId !== "unassigned" && row.assignedEmployeeId !== employeeId) return false;
      if (district !== "All" && row.district !== district) return false;
      if (city !== "All" && row.city !== city) return false;

      if (search) {
        const hay = `${row.leadCode} ${row.customerName} ${row.mobile} ${row.registrationNumber} ${row.vehicle} ${row.campaignName} ${row.assignedEmployeeName} ${row.city}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "customerName") return a.customerName.localeCompare(b.customerName) * dir;
      if (sortBy === "city") return a.city.localeCompare(b.city) * dir;
      if (sortBy === "status") return ((STAGE_INDEX[a.status] ?? 0) - (STAGE_INDEX[b.status] ?? 0)) * dir;
      if (sortBy === "intentScore") return (a.intentScore - b.intentScore) * dir;
      if (sortBy === "leadCode") return a.leadCode.localeCompare(b.leadCode) * dir;
      return (new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime()) * dir;
    });

    const totalCount = filtered.length;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    // Reference lists for dropdowns & Lost reason summary
    const [leadSources, allCampaigns, adSets, ads, employees] = await Promise.all([
      prisma.leadSource.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.campaign.findMany({ select: { id: true, name: true, campaignCode: true }, orderBy: { campaignCode: "asc" } }),
      prisma.adSet.findMany({ select: { id: true, name: true, campaignId: true }, orderBy: { adSetCode: "asc" } }),
      prisma.ad.findMany({ select: { id: true, name: true, campaignId: true, adSetId: true }, orderBy: { adCode: "asc" } }),
      prisma.employee.findMany({
        where: { accountStatus: "Active" },
        select: { id: true, fullName: true, assignedCity: true, assignedDistrict: true, role: { select: { code: true } } },
        orderBy: { fullName: "asc" },
      }),
    ]);

    const lostReasonCounts = new Map<string, number>();
    for (const r of enriched.filter((l) => l.status === "Lost")) {
      const reason = r.lostReason || "Other";
      lostReasonCounts.set(reason, (lostReasonCounts.get(reason) ?? 0) + 1);
    }

    return NextResponse.json({
      leads: paginated,
      allLeadsForPipeline: view === "pipeline" ? filtered : undefined,
      totalCount,
      page,
      pageSize,
      summary: {
        total: enriched.length,
        lostCount: enriched.filter((l) => l.status === "Lost").length,
        duplicateCount: enriched.filter((l) => l.isDuplicate).length,
        recoveryCount: enriched.filter((l) => l.needsRecovery).length,
        lostReasonBreakdown: Array.from(lostReasonCounts.entries())
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count),
      },
      options: { leadSources, campaigns: allCampaigns, adSets, ads, employees },
    });
  } catch (err) {
    console.error("Leads GET error:", err);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "leads:create")) {
      return NextResponse.json({ error: "Forbidden: cannot create leads" }, { status: 403 });
    }

    const body = await req.json();
    const customerName = String(body.customerName ?? "").trim();
    const primaryMobile = String(body.primaryMobile ?? "").trim();
    const registrationNumber = String(body.registrationNumber ?? "").trim().toUpperCase();
    const district = String(body.district ?? "Ahmedabad").trim();
    const city = String(body.city ?? "Ahmedabad").trim();

    if (!customerName || !primaryMobile) {
      return NextResponse.json({ error: "Customer name and primary mobile number are required." }, { status: 400 });
    }

    // Duplicate Detection (Section 7.7): mobile, vehicle reg, or existing customer
    const potentialDuplicates = await prisma.lead.findMany({
      where: {
        isDeleted: false,
        OR: [
          { customer: { primaryMobile } },
          ...(registrationNumber ? [{ vehicles: { some: { registrationNumber } } }] : []),
        ],
      },
      include: {
        customer: { select: { name: true, primaryMobile: true, city: true } },
        vehicles: { select: { registrationNumber: true, manufacturer: true, model: true } },
      },
    });

    if (potentialDuplicates.length > 0 && !body.confirmDuplicate) {
      return NextResponse.json(
        {
          duplicateWarning: true,
          message: "Potential duplicate enquiry detected matching mobile number or vehicle registration.",
          duplicates: potentialDuplicates.map((d) => ({
            id: d.id,
            leadCode: d.leadCode,
            customerName: d.customer.name,
            mobile: d.customer.primaryMobile,
            city: d.customer.city,
            status: d.status,
            vehicle: d.vehicles[0] ? `${d.vehicles[0].manufacturer} ${d.vehicles[0].model} (${d.vehicles[0].registrationNumber})` : "—",
          })),
        },
        { status: 409 }
      );
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({ where: { primaryMobile } });
    if (!customer) {
      const custCount = await prisma.customer.count();
      customer = await prisma.customer.create({
        data: {
          customerCode: `CUS-${String(custCount + 1).padStart(4, "0")}`,
          name: customerName,
          primaryMobile,
          altMobile: body.altMobile ? String(body.altMobile).trim() : null,
          email: body.email ? String(body.email).trim() : null,
          state: String(body.state || "Gujarat"),
          district,
          city,
          area: body.area ? String(body.area).trim() : null,
          pinCode: body.pinCode ? String(body.pinCode).trim() : null,
          fullAddress: body.fullAddress ? String(body.fullAddress).trim() : null,
          preferredContactMethod: String(body.preferredContactMethod || "Phone Call"),
        },
      });
    }

    const sourceRec =
      (body.leadSourceId
        ? await prisma.leadSource.findUnique({ where: { id: String(body.leadSourceId) } })
        : null) ??
      (await prisma.leadSource.findFirst({
        where: { name: String(body.leadSourceName || "Facebook") },
      })) ??
      (await prisma.leadSource.findFirst());

    if (!sourceRec) {
      return NextResponse.json({ error: "Lead source configuration missing." }, { status: 400 });
    }

    const status = String(body.status || (body.assignedEmployeeId ? "Assigned" : "New"));
    if (status === "Lost" && !body.lostReason) {
      return NextResponse.json({ error: "Lost reason is required when creating a Lost lead." }, { status: 400 });
    }

    const scoring = evaluateLeadIntent({
      respondedToFirstCall: status !== "New" && status !== "Assigned",
      vehicleDetailsProvided: Boolean(body.manufacturer && body.model),
      district,
      rcAvailable: String(body.rcAvailable || "Yes"),
      status,
      hasAcceptedOrNegotiatingQuote: ["Negotiation", "Deal Confirmed"].includes(status),
      hasScheduledOrDoneInspection: ["Inspection Required", "Quotation Given", "Negotiation", "Deal Confirmed"].includes(status),
    });

    const leadCount = await prisma.lead.count();
    const leadCode = `LD-2026-${String(leadCount + 1).padStart(4, "0")}`;

    const qualificationStatus =
      status === "New" || status === "Assigned"
        ? "Unverified"
        : String(body.qualificationStatus || "Pending Verification");

    const lead = await prisma.lead.create({
      data: {
        leadCode,
        customerId: customer.id,
        leadSourceId: sourceRec.id,
        campaignId: body.campaignId || null,
        adSetId: body.adSetId || null,
        adId: body.adId || null,
        firstTouchSource: sourceRec.name,
        lastTouchSource: sourceRec.name,
        attributionMethod: "First-Touch",
        attributionConfidence: body.campaignId ? "Confirmed" : "Self-Reported",
        enquiryDate: body.enquiryDate ? new Date(body.enquiryDate) : new Date(),
        expectedSellingPrice: body.expectedSellingPrice ? Number(body.expectedSellingPrice) : null,
        assignedEmployeeId: body.assignedEmployeeId || null,
        createdById: session.employeeId,
        assignedById: body.assignedEmployeeId ? session.employeeId : null,
        priority: String(body.priority || "Warm"),
        status,
        lostReason: status === "Lost" ? String(body.lostReason) : null,
        qualificationStatus,
        intentScore: scoring.score,
        intentCategory: scoring.category,
        nextFollowUpAt: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
        customerNotes: body.customerNotes ? String(body.customerNotes) : null,
        internalRemarks: body.internalRemarks ? String(body.internalRemarks) : null,
        isDuplicate: potentialDuplicates.length > 0,
        duplicateOfLeadId: potentialDuplicates[0]?.id ?? null,
      },
    });

    if (body.manufacturer && body.model) {
      const vehCount = await prisma.vehicle.count();
      await prisma.vehicle.create({
        data: {
          vehicleCode: `VEH-${String(vehCount + 1).padStart(4, "0")}`,
          customerId: customer.id,
          leadId: lead.id,
          registrationNumber: registrationNumber || `GJ-01-TEMP-${vehCount + 1}`,
          manufacturer: String(body.manufacturer),
          model: String(body.model),
          variant: body.variant ? String(body.variant) : null,
          manufacturingYear: Number(body.manufacturingYear || 2010),
          category: String(body.vehicleCategory || "Hatchback"),
          fuelType: String(body.fuelType || "Petrol"),
          vehicleCondition: String(body.vehicleCondition || "Fair"),
          runningCondition: String(body.runningCondition || "Running"),
          locationState: "Gujarat",
          locationDistrict: district,
          locationCity: city,
          locationArea: body.area ? String(body.area) : null,
          locationPinCode: body.pinCode ? String(body.pinCode) : null,
          ownershipDetails: String(body.ownershipStatus || "1st Owner"),
          rcAvailable: String(body.rcAvailable || "Yes"),
          insuranceStatus: String(body.insuranceStatus || "Expired"),
          additionalDetails: body.additionalVehicleDetails ? String(body.additionalVehicleDetails) : null,
        },
      });
    }

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: "Lead Created",
        newStatus: status,
        summary: `Lead ${lead.leadCode} created for ${customer.name} (${city})`,
        performedById: session.employeeId,
      },
    });

    if (body.assignedEmployeeId) {
      await prisma.leadAssignment.create({
        data: {
          leadId: lead.id,
          toEmployeeId: String(body.assignedEmployeeId),
          assignedById: session.employeeId,
          reason: "Initial lead assignment",
        },
      });
    }

    await createNotification({
      title: `New Lead ${lead.leadCode}`,
      description: `${customer.name} (${city}) via ${sourceRec.name}`,
      category: "New lead received",
      relatedModule: "leads",
      relatedRecordId: lead.id,
    });

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "LEAD_CREATED",
      entityType: "Lead",
      entityId: lead.id,
      summary: `Created lead ${lead.leadCode} for ${customer.name}`,
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    console.error("Leads POST error:", err);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
