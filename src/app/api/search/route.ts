import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ results: [] });

    const canViewFinance = canPerform(session, "finance:view");
    const canViewAds = canPerform(session, "meta_ads:view");
    const viewAllLeads = canPerform(session, "leads:view_all");

    const [leads, customers, vehicles, campaigns, transactions, employees] = await Promise.all([
      prisma.lead.findMany({
        where: {
          isDeleted: false,
          ...(!viewAllLeads && session.employeeId ? { assignedEmployeeId: session.employeeId } : {}),
          OR: [
            { leadCode: { contains: q } },
            { customer: { name: { contains: q } } },
            { customer: { primaryMobile: { contains: q } } },
          ],
        },
        include: { customer: { select: { name: true, primaryMobile: true, city: true } } },
        take: 5,
      }),
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { primaryMobile: { contains: q } },
            { customerCode: { contains: q } },
            { city: { contains: q } },
            { district: { contains: q } },
          ],
        },
        take: 4,
      }),
      prisma.vehicle.findMany({
        where: {
          OR: [
            { registrationNumber: { contains: q } },
            { model: { contains: q } },
            { manufacturer: { contains: q } },
            { vehicleCode: { contains: q } },
          ],
        },
        take: 4,
      }),
      canViewAds
        ? prisma.campaign.findMany({
            where: { OR: [{ name: { contains: q } }, { campaignCode: { contains: q } }] },
            take: 4,
          })
        : Promise.resolve([]),
      canViewFinance
        ? prisma.transaction.findMany({
            where: { transactionCode: { contains: q } },
            include: { vehicle: { select: { registrationNumber: true } } },
            take: 4,
          })
        : Promise.resolve([]),
      prisma.employee.findMany({
        where: { OR: [{ fullName: { contains: q } }, { employeeCode: { contains: q } }] },
        take: 4,
      }),
    ]);

    const results = [
      ...leads.map((l) => ({
        type: "Lead",
        id: l.id,
        title: `${l.leadCode} — ${l.customer.name}`,
        subtitle: `${l.customer.primaryMobile} · ${l.customer.city} · ${l.status}`,
        href: `/leads/${l.id}`,
      })),
      ...customers.map((c) => ({
        type: "Customer",
        id: c.id,
        title: `${c.customerCode} — ${c.name}`,
        subtitle: `${c.primaryMobile} · ${c.city}, ${c.district}`,
        href: `/customers?id=${c.id}`,
      })),
      ...vehicles.map((v) => ({
        type: "Vehicle",
        id: v.id,
        title: `${v.registrationNumber} — ${v.manufacturer} ${v.model}`,
        subtitle: `${v.vehicleCode} · ${v.manufacturingYear} · ${v.purchaseStatus}`,
        href: `/vehicles?search=${encodeURIComponent(v.registrationNumber)}`,
      })),
      ...campaigns.map((c) => ({
        type: "Campaign",
        id: c.id,
        title: `${c.campaignCode} — ${c.name}`,
        subtitle: `${c.platform} · ${c.status}`,
        href: `/meta-ads?campaignId=${c.id}`,
      })),
      ...transactions.map((t) => ({
        type: "Transaction",
        id: t.id,
        title: `${t.transactionCode} — ${t.vehicle.registrationNumber}`,
        subtitle: `${t.transactionStatus} · ${t.paymentStatus}`,
        href: `/transactions?search=${encodeURIComponent(t.transactionCode)}`,
      })),
      ...employees.map((e) => ({
        type: "Employee",
        id: e.id,
        title: `${e.employeeCode} — ${e.fullName}`,
        subtitle: `${e.assignedCity}, ${e.assignedDistrict}`,
        href: `/team`,
      })),
    ];

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Global search error:", err);
    return NextResponse.json({ results: [] });
  }
}
