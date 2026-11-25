import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function daysAgo(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysFromNow(days: number, hour = 11, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Deterministic pseudo-random helper so seed metrics remain consistent and realistic
function seededRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

async function main() {
  console.log("Seeding Movish Group — Business Management System database...");

  // Clear existing data in safe foreign-key order
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.communicationLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.revenue.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.document.deleteMany();
  await prisma.pickup.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.leadAssignment.deleteMany();
  await prisma.leadActivity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.adMetric.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.leadSource.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.systemSetting.deleteMany();

  // 1. Roles & Permissions
  const roleData = [
    { code: "SUPER_ADMIN", name: "Super Admin / Business Owner", description: "Full access across analytics, leads, operations, financials, users, and audit logs." },
    { code: "ADMIN", name: "Admin", description: "Manage leads, customers, vehicles, operations, campaigns, and permitted users." },
    { code: "MANAGER", name: "Manager", description: "Assign leads, monitor sales activity, review quotations, and track pickups." },
    { code: "SALES_EXECUTIVE", name: "Sales Executive", description: "Manage assigned leads, follow-ups, customer details, and submit quotations." },
    { code: "MARKETING_EXECUTIVE", name: "Marketing Executive", description: "View Meta Ads performance, compare campaigns/ads, and analyze lead sources." },
    { code: "OPERATIONS_EXECUTIVE", name: "Operations Executive", description: "Manage vehicle inspections, pickups, documentation checklists, and processing." },
    { code: "ACCOUNTS_EXECUTIVE", name: "Accounts Executive", description: "Record purchase payments, expenses, revenues, and financial reports." },
  ];

  const roles: Record<string, string> = {};
  for (const r of roleData) {
    const created = await prisma.role.create({ data: r });
    roles[r.code] = created.id;
  }

  const permissionData = [
    { code: "dashboard:view", module: "Dashboard", action: "View", description: "View business overview dashboard" },
    { code: "meta_ads:view", module: "Meta Ads", action: "View", description: "View Meta advertising analytics" },
    { code: "meta_ads:manage", module: "Meta Ads", action: "Manage", description: "Manage campaign settings & sync" },
    { code: "leads:view", module: "Leads", action: "View", description: "View leads and pipeline" },
    { code: "leads:view_all", module: "Leads", action: "View All", description: "View all leads across employees" },
    { code: "leads:create", module: "Leads", action: "Create", description: "Create new leads" },
    { code: "leads:edit", module: "Leads", action: "Edit", description: "Edit lead details and status" },
    { code: "leads:delete", module: "Leads", action: "Delete", description: "Soft-delete leads" },
    { code: "leads:assign", module: "Leads", action: "Assign", description: "Assign and reassign leads" },
    { code: "leads:merge", module: "Leads", action: "Merge", description: "Merge duplicate lead records" },
    { code: "followups:manage", module: "Follow-ups", action: "Manage", description: "Create and complete follow-ups" },
    { code: "customers:manage", module: "Customers", action: "Manage", description: "Create and edit customer profiles" },
    { code: "vehicles:view", module: "Vehicles", action: "View", description: "View vehicle records" },
    { code: "vehicles:manage", module: "Vehicles", action: "Manage", description: "Manage vehicles, inspections, pickups, docs" },
    { code: "quotations:create", module: "Quotations", action: "Create", description: "Prepare and submit quotations" },
    { code: "quotations:approve", module: "Quotations", action: "Approve", description: "Approve or reject vehicle quotations" },
    { code: "finance:view", module: "Finance", action: "View", description: "View transactions, expenses, revenues, and profit" },
    { code: "finance:manage", module: "Finance", action: "Manage", description: "Record payments, expenses, and revenues" },
    { code: "team:view", module: "Team", action: "View", description: "View employee performance and targets" },
    { code: "team:manage", module: "Team", action: "Manage", description: "Manage employees and monthly targets" },
    { code: "reports:view", module: "Reports", action: "View", description: "View business intelligence reports" },
    { code: "reports:export", module: "Reports", action: "Export", description: "Export CSV, Excel, and PDF reports" },
    { code: "settings:manage", module: "Settings", action: "Manage", description: "Manage company settings, users, and permissions" },
    { code: "audit:view", module: "Audit", action: "View", description: "View system audit logs" },
  ];

  const perms: Record<string, string> = {};
  for (const p of permissionData) {
    const created = await prisma.permission.create({ data: p });
    perms[p.code] = created.id;
  }

  const rolePermMatrix: Record<string, string[]> = {
    SUPER_ADMIN: permissionData.map((p) => p.code),
    ADMIN: permissionData.filter((p) => p.code !== "audit:view").map((p) => p.code),
    MANAGER: [
      "dashboard:view", "meta_ads:view", "leads:view", "leads:view_all", "leads:create", "leads:edit",
      "leads:assign", "leads:merge", "followups:manage", "customers:manage", "vehicles:view",
      "quotations:create", "quotations:approve", "team:view", "team:manage", "reports:view", "reports:export",
    ],
    SALES_EXECUTIVE: [
      "dashboard:view", "leads:view", "leads:create", "leads:edit", "followups:manage",
      "customers:manage", "vehicles:view", "quotations:create",
    ],
    MARKETING_EXECUTIVE: [
      "dashboard:view", "meta_ads:view", "meta_ads:manage", "leads:view", "leads:view_all",
      "reports:view", "reports:export",
    ],
    OPERATIONS_EXECUTIVE: [
      "dashboard:view", "vehicles:view", "vehicles:manage", "customers:manage", "reports:view",
    ],
    ACCOUNTS_EXECUTIVE: [
      "dashboard:view", "finance:view", "finance:manage", "vehicles:view", "reports:view", "reports:export",
    ],
  };

  for (const [rCode, permCodes] of Object.entries(rolePermMatrix)) {
    for (const p of permissionData) {
      await prisma.rolePermission.create({
        data: {
          roleId: roles[rCode],
          permissionId: perms[p.code],
          allowed: permCodes.includes(p.code),
        },
      });
    }
  }

  // 2. Employees & Login Users
  const empOwner = await prisma.employee.create({
    data: {
      employeeCode: "EMP-001",
      fullName: "Rajeshbhai Patel",
      mobile: "9825011001",
      email: "owner@movishgroup.in",
      roleId: roles.SUPER_ADMIN,
      joiningDate: new Date("2022-04-01"),
      assignedDistrict: "Ahmedabad",
      assignedCity: "Ahmedabad",
      accountStatus: "Active",
      monthlyLeadTarget: 40,
      monthlyQualifiedTarget: 20,
      monthlyQuotationTarget: 15,
      monthlyDealTarget: 10,
      monthlyPickupTarget: 10,
      monthlyCompletedTarget: 8,
    },
  });

  const empAdmin = await prisma.employee.create({
    data: {
      employeeCode: "EMP-002",
      fullName: "Neha Shah",
      mobile: "9825011002",
      email: "admin@movishgroup.in",
      roleId: roles.ADMIN,
      joiningDate: new Date("2023-01-15"),
      assignedDistrict: "Ahmedabad",
      assignedCity: "Ahmedabad",
      reportingManagerId: empOwner.id,
      monthlyLeadTarget: 35,
      monthlyQualifiedTarget: 18,
      monthlyQuotationTarget: 14,
      monthlyDealTarget: 9,
      monthlyPickupTarget: 9,
      monthlyCompletedTarget: 7,
    },
  });

  const empManager = await prisma.employee.create({
    data: {
      employeeCode: "EMP-003",
      fullName: "Vikram Desai",
      mobile: "9825011003",
      email: "manager@movishgroup.in",
      roleId: roles.MANAGER,
      joiningDate: new Date("2023-03-10"),
      assignedDistrict: "Ahmedabad",
      assignedCity: "Ahmedabad",
      reportingManagerId: empOwner.id,
      monthlyLeadTarget: 45,
      monthlyQualifiedTarget: 22,
      monthlyQuotationTarget: 16,
      monthlyDealTarget: 11,
      monthlyPickupTarget: 10,
      monthlyCompletedTarget: 9,
    },
  });

  const empSales1 = await prisma.employee.create({
    data: {
      employeeCode: "EMP-004",
      fullName: "Karan Mehta",
      mobile: "9825011004",
      email: "karan.sales@movishgroup.in",
      roleId: roles.SALES_EXECUTIVE,
      joiningDate: new Date("2023-08-01"),
      assignedDistrict: "Ahmedabad",
      assignedCity: "Ahmedabad",
      reportingManagerId: empManager.id,
      monthlyLeadTarget: 30,
      monthlyQualifiedTarget: 16,
      monthlyQuotationTarget: 12,
      monthlyDealTarget: 8,
      monthlyPickupTarget: 8,
      monthlyCompletedTarget: 6,
    },
  });

  const empSales2 = await prisma.employee.create({
    data: {
      employeeCode: "EMP-005",
      fullName: "Priya Joshi",
      mobile: "9879022005",
      email: "priya.sales@movishgroup.in",
      roleId: roles.SALES_EXECUTIVE,
      joiningDate: new Date("2024-01-10"),
      assignedDistrict: "Surat",
      assignedCity: "Surat",
      reportingManagerId: empManager.id,
      monthlyLeadTarget: 28,
      monthlyQualifiedTarget: 15,
      monthlyQuotationTarget: 11,
      monthlyDealTarget: 7,
      monthlyPickupTarget: 7,
      monthlyCompletedTarget: 6,
    },
  });

  const empSales3 = await prisma.employee.create({
    data: {
      employeeCode: "EMP-006",
      fullName: "Darshan Gohil",
      mobile: "9898033006",
      email: "darshan.sales@movishgroup.in",
      roleId: roles.SALES_EXECUTIVE,
      joiningDate: new Date("2024-04-05"),
      assignedDistrict: "Vadodara",
      assignedCity: "Vadodara",
      reportingManagerId: empManager.id,
      monthlyLeadTarget: 25,
      monthlyQualifiedTarget: 13,
      monthlyQuotationTarget: 10,
      monthlyDealTarget: 6,
      monthlyPickupTarget: 6,
      monthlyCompletedTarget: 5,
    },
  });

  const empSales4 = await prisma.employee.create({
    data: {
      employeeCode: "EMP-007",
      fullName: "Harshil Trivedi",
      mobile: "9909044007",
      email: "harshil.sales@movishgroup.in",
      roleId: roles.SALES_EXECUTIVE,
      joiningDate: new Date("2024-07-01"),
      assignedDistrict: "Rajkot",
      assignedCity: "Rajkot",
      reportingManagerId: empManager.id,
      monthlyLeadTarget: 25,
      monthlyQualifiedTarget: 12,
      monthlyQuotationTarget: 9,
      monthlyDealTarget: 6,
      monthlyPickupTarget: 5,
      monthlyCompletedTarget: 4,
    },
  });

  const empMarketing = await prisma.employee.create({
    data: {
      employeeCode: "EMP-008",
      fullName: "Ritu Parmar",
      mobile: "9825011008",
      email: "marketing@movishgroup.in",
      roleId: roles.MARKETING_EXECUTIVE,
      joiningDate: new Date("2023-11-20"),
      assignedDistrict: "Ahmedabad",
      assignedCity: "Ahmedabad",
      reportingManagerId: empOwner.id,
      monthlyLeadTarget: 120,
      monthlyQualifiedTarget: 60,
      monthlyQuotationTarget: 0,
      monthlyDealTarget: 0,
      monthlyPickupTarget: 0,
      monthlyCompletedTarget: 0,
    },
  });

  const empOps = await prisma.employee.create({
    data: {
      employeeCode: "EMP-009",
      fullName: "Jignesh Solanki",
      mobile: "9825011009",
      email: "operations@movishgroup.in",
      roleId: roles.OPERATIONS_EXECUTIVE,
      joiningDate: new Date("2023-05-12"),
      assignedDistrict: "Ahmedabad",
      assignedCity: "Naroda GIDC",
      reportingManagerId: empAdmin.id,
      monthlyLeadTarget: 0,
      monthlyQualifiedTarget: 0,
      monthlyQuotationTarget: 0,
      monthlyDealTarget: 0,
      monthlyPickupTarget: 25,
      monthlyCompletedTarget: 20,
    },
  });

  const empAccounts = await prisma.employee.create({
    data: {
      employeeCode: "EMP-010",
      fullName: "Meera Dave",
      mobile: "9825011010",
      email: "accounts@movishgroup.in",
      roleId: roles.ACCOUNTS_EXECUTIVE,
      joiningDate: new Date("2023-06-01"),
      assignedDistrict: "Ahmedabad",
      assignedCity: "Ahmedabad",
      reportingManagerId: empOwner.id,
      monthlyLeadTarget: 0,
      monthlyQualifiedTarget: 0,
      monthlyQuotationTarget: 0,
      monthlyDealTarget: 0,
      monthlyPickupTarget: 0,
      monthlyCompletedTarget: 25,
    },
  });

  const defaultPassHash = hashPassword("Movish@2026");
  const userAccounts = [
    { email: "owner@movishgroup.in", name: empOwner.fullName, roleId: roles.SUPER_ADMIN, employeeId: empOwner.id },
    { email: "admin@movishgroup.in", name: empAdmin.fullName, roleId: roles.ADMIN, employeeId: empAdmin.id },
    { email: "manager@movishgroup.in", name: empManager.fullName, roleId: roles.MANAGER, employeeId: empManager.id },
    { email: "karan.sales@movishgroup.in", name: empSales1.fullName, roleId: roles.SALES_EXECUTIVE, employeeId: empSales1.id },
    { email: "marketing@movishgroup.in", name: empMarketing.fullName, roleId: roles.MARKETING_EXECUTIVE, employeeId: empMarketing.id },
    { email: "operations@movishgroup.in", name: empOps.fullName, roleId: roles.OPERATIONS_EXECUTIVE, employeeId: empOps.id },
    { email: "accounts@movishgroup.in", name: empAccounts.fullName, roleId: roles.ACCOUNTS_EXECUTIVE, employeeId: empAccounts.id },
  ];

  const createdUsers: Array<{ id: string; name: string; email: string }> = [];
  for (const u of userAccounts) {
    const usr = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: defaultPassHash,
        name: u.name,
        roleId: u.roleId,
        employeeId: u.employeeId,
        isActive: true,
        lastLoginAt: daysAgo(1, 9, 30),
      },
    });
    createdUsers.push(usr);
  }

  // 3. Gujarat Locations
  const gujaratLocationSeed = [
    { district: "Ahmedabad", city: "Ahmedabad", town: "Naroda", area: "Naroda GIDC", pinCode: "382330", yardLocation: "Movish Yard 1 — Naroda" },
    { district: "Ahmedabad", city: "Ahmedabad", town: "Sarkhej", area: "SG Highway", pinCode: "382210", yardLocation: "Movish Yard 1 — Naroda" },
    { district: "Ahmedabad", city: "Ahmedabad", town: "Bopal", area: "South Bopal", pinCode: "380058", yardLocation: "Movish Yard 1 — Naroda" },
    { district: "Ahmedabad", city: "Sanand", town: "Sanand", area: "Sanand GIDC", pinCode: "382110", yardLocation: "Movish Yard 1 — Naroda" },
    { district: "Surat", city: "Surat", town: "Sachin", area: "Sachin GIDC", pinCode: "394230", yardLocation: "Movish South Yard — Sachin" },
    { district: "Surat", city: "Surat", town: "Adajan", area: "Pal Road", pinCode: "395009", yardLocation: "Movish South Yard — Sachin" },
    { district: "Surat", city: "Surat", town: "Katargam", area: "Gajera Circle", pinCode: "395004", yardLocation: "Movish South Yard — Sachin" },
    { district: "Vadodara", city: "Vadodara", town: "Makarpura", area: "Makarpura GIDC", pinCode: "390010", yardLocation: "Movish Central Yard — Makarpura" },
    { district: "Vadodara", city: "Vadodara", town: "Alkapuri", area: "RC Dutt Road", pinCode: "390007", yardLocation: "Movish Central Yard — Makarpura" },
    { district: "Rajkot", city: "Rajkot", town: "Shapar", area: "Shapar Veraval", pinCode: "360024", yardLocation: "Movish Saurashtra Yard — Shapar" },
    { district: "Rajkot", city: "Rajkot", town: "Kalawad", area: "Kalawad Road", pinCode: "360005", yardLocation: "Movish Saurashtra Yard — Shapar" },
    { district: "Gandhinagar", city: "Gandhinagar", town: "Kudasan", area: "Sector 21", pinCode: "382021", yardLocation: "Movish Yard 1 — Naroda" },
    { district: "Bhavnagar", city: "Bhavnagar", town: "Chitra", area: "Chitra GIDC", pinCode: "364004", yardLocation: "Movish Saurashtra Yard — Shapar" },
    { district: "Jamnagar", city: "Jamnagar", town: "Dared", area: "Dared GIDC", pinCode: "361004", yardLocation: "Movish Saurashtra Yard — Shapar" },
    { district: "Anand", city: "Anand", town: "Vidyanagar", area: "Vallabh Vidyanagar", pinCode: "388120", yardLocation: "Movish Central Yard — Makarpura" },
    { district: "Bharuch", city: "Ankleshwar", town: "Ankleshwar", area: "Ankleshwar GIDC", pinCode: "393002", yardLocation: "Movish South Yard — Sachin" },
    { district: "Mehsana", city: "Mehsana", town: "Mehsana", area: "Modhera Road", pinCode: "384002", yardLocation: "Movish Yard 1 — Naroda" },
    { district: "Valsad", city: "Vapi", town: "Vapi", area: "Vapi GIDC", pinCode: "396195", yardLocation: "Movish South Yard — Sachin" },
    { district: "Kutch", city: "Gandhidham", town: "Gandhidham", area: "Kandla Road", pinCode: "370201", yardLocation: "Movish Saurashtra Yard — Shapar" },
    { district: "Morbi", city: "Morbi", town: "Morbi", area: "Sanala Road", pinCode: "363641", yardLocation: "Movish Saurashtra Yard — Shapar" },
    { district: "Junagadh", city: "Junagadh", town: "Junagadh", area: "Joshipura", pinCode: "362002", yardLocation: "Movish Saurashtra Yard — Shapar" },
    { district: "Navsari", city: "Navsari", town: "Navsari", area: "Grid Road", pinCode: "396445", yardLocation: "Movish South Yard — Sachin" },
  ];

  const locationRecords = [];
  for (const loc of gujaratLocationSeed) {
    locationRecords.push(await prisma.location.create({ data: { state: "Gujarat", ...loc, isServiceable: true } }));
  }

  // 4. Lead Sources (8)
  const leadSourceSeed = [
    { name: "Facebook", category: "Paid Meta", sortOrder: 1 },
    { name: "Instagram", category: "Paid Meta", sortOrder: 2 },
    { name: "WhatsApp", category: "Direct Messaging", sortOrder: 3 },
    { name: "Website", category: "Owned Web", sortOrder: 4 },
    { name: "Phone Calls", category: "Inbound Call", sortOrder: 5 },
    { name: "Referrals", category: "Word of Mouth", sortOrder: 6 },
    { name: "Organic Sources", category: "Organic", sortOrder: 7 },
    { name: "Other Sources", category: "Other", sortOrder: 8 },
  ];

  const sources: Record<string, string> = {};
  for (const s of leadSourceSeed) {
    const rec = await prisma.leadSource.create({ data: s });
    sources[s.name] = rec.id;
  }

  // 5. Meta Campaigns (12), Ad Sets (24), Ads (36)
  const campaignTemplates = [
    { name: "Ahmedabad Instant Scrap Car Quote", objective: "Lead Generation", platform: "Facebook", budget: 65000, status: "Active" },
    { name: "Surat 15-Year End-of-Life Car Buyback", objective: "Lead Generation", platform: "Instagram", budget: 52000, status: "Active" },
    { name: "Vadodara Old Diesel Vehicle Scrap", objective: "Lead Generation", platform: "Facebook", budget: 48000, status: "Active" },
    { name: "Rajkot & Saurashtra Scrap Car Pickup", objective: "Lead Generation", platform: "Facebook & Instagram", budget: 55000, status: "Active" },
    { name: "Gujarat Accident & Non-Running Car Buy", objective: "Conversions", platform: "Facebook", budget: 45000, status: "Active" },
    { name: "WhatsApp Direct Scrap Car Valuation", objective: "Messages", platform: "Instagram", budget: 38000, status: "Active" },
    { name: "Gandhinagar & Mehsana Car Deregistration", objective: "Lead Generation", platform: "Facebook", budget: 34000, status: "Active" },
    { name: "Bharuch & Vapi Industrial Belt Car Scrap", objective: "Lead Generation", platform: "Instagram", budget: 30000, status: "Active" },
    { name: "Gujarat Monsoon Flood-Damaged Car Scrap", objective: "Conversions", platform: "Facebook & Instagram", budget: 42000, status: "Paused" },
    { name: "Commercial Van & Tempo Scrap Drive", objective: "Lead Generation", platform: "Facebook", budget: 36000, status: "Active" },
    { name: "Reels High-Value Scrap Steel Awareness", objective: "Traffic", platform: "Instagram", budget: 25000, status: "Active" },
    { name: "Q3 Gujarat RVSF Scrap Certificate Campaign", objective: "Lead Generation", platform: "Facebook", budget: 40000, status: "Completed" },
  ];

  const campaigns: Array<{ id: string; name: string; platform: string; adSets: Array<{ id: string; ads: Array<{ id: string; platform: string }> }> }> = [];

  for (let i = 0; i < campaignTemplates.length; i++) {
    const ct = campaignTemplates[i];
    const cmp = await prisma.campaign.create({
      data: {
        campaignCode: `CMP-${String(i + 1).padStart(3, "0")}`,
        metaCampaignId: `23859${100000 + i * 137}`,
        name: ct.name,
        objective: ct.objective,
        platform: ct.platform,
        status: ct.status,
        budget: ct.budget,
        startDate: daysAgo(60 - (i % 3) * 5),
        endDate: ct.status === "Completed" ? daysAgo(7) : null,
        attributionWindowDays: 7,
      },
    });

    const adSetsForCmp: Array<{ id: string; ads: Array<{ id: string; platform: string }> }> = [];

    for (let sIdx = 0; sIdx < 2; sIdx++) {
      const adSetPlatform =
        ct.platform === "Facebook & Instagram" ? (sIdx === 0 ? "Facebook" : "Instagram") : ct.platform;
      const adSet = await prisma.adSet.create({
        data: {
          adSetCode: `ADS-${String(i * 2 + sIdx + 1).padStart(3, "0")}`,
          metaAdSetId: `23861${200000 + i * 10 + sIdx}`,
          campaignId: cmp.id,
          name: `${ct.name.split(" ").slice(0, 2).join(" ")} — ${sIdx === 0 ? "Car Owners 30-58" : "Lookalike Auto Owners"}`,
          audienceInfo: sIdx === 0 ? "Gujarat Geo 25km | Age 30-58 | Vehicle Owners" : "2% Lookalike Past Scrap Sellers",
          placement: adSetPlatform === "Instagram" ? "Instagram Reels & Stories" : "Facebook Feed & Marketplace",
          budget: Math.round(ct.budget / 2),
          status: ct.status === "Completed" ? "Completed" : "Active",
        },
      });

      const adsForSet: Array<{ id: string; platform: string }> = [];
      const adsPerSet = sIdx === 0 ? 2 : 1; // 3 ads per campaign = 36 ads total
      for (let aIdx = 0; aIdx < adsPerSet; aIdx++) {
        const adNum = i * 3 + sIdx * 2 + aIdx + 1;
        const ad = await prisma.ad.create({
          data: {
            adCode: `AD-${String(adNum).padStart(3, "0")}`,
            metaAdId: `23863${300000 + adNum}`,
            campaignId: cmp.id,
            adSetId: adSet.id,
            name: `${ct.name.split(" ")[0]} Creative #${sIdx * 2 + aIdx + 1} (${adSetPlatform})`,
            creativePreviewUrl: "/logo.png",
            primaryText:
              aIdx === 0
                ? "15+ year old car? Get instant cash quote + free towing anywhere in Gujarat with legal scrapping certificate from Movish Group."
                : "Accident or non-running car sitting idle? Movish Group offers best scrap valuation & doorstep pickup across Gujarat.",
            headline: aIdx === 0 ? "Sell Scrap Car at Best Rate in Gujarat" : "Free Pickup & Legal RC Deregistration",
            cta: ct.objective === "Messages" ? "Send WhatsApp Message" : "Get Quote",
            platform: adSetPlatform,
            placement: adSetPlatform === "Instagram" ? "Instagram Reels" : "Facebook Feed",
            status: ct.status === "Completed" ? "Completed" : "Active",
          },
        });
        adsForSet.push({ id: ad.id, platform: adSetPlatform });
      }
      adSetsForCmp.push({ id: adSet.id, ads: adsForSet });
    }
    campaigns.push({ id: cmp.id, name: cmp.name, platform: ct.platform, adSets: adSetsForCmp });
  }

  // 6. Customers (78) & Leads (120)
  const firstNames = [
    "Amit", "Bhavesh", "Chetan", "Dipak", "Ekta", "Falgun", "Gaurav", "Hitesh", "Ishan", "Jayesh",
    "Ketan", "Lalit", "Mahesh", "Nilesh", "Omkar", "Paresh", "Rakesh", "Sandeep", "Tushar", "Umesh",
    "Vinod", "Yash", "Zalak", "Anil", "Bharat", "Chirag", "Devendra", "Gopal", "Hemant", "Jatin",
    "Kamlesh", "Manish", "Nitin", "Prakash", "Ramesh", "Sanjay", "Tarun", "Vimal", "Yogesh", "Ashok",
  ];
  const lastNames = [
    "Patel", "Shah", "Desai", "Mehta", "Joshi", "Trivedi", "Pandya", "Bhatt", "Parikh", "Modi",
    "Jadeja", "Solanki", "Chauhan", "Rathod", "Gohil", "Prajapati", "Vyas", "Kothari", "Thakkar", "Soni",
  ];

  const vehicleTemplates = [
    { manufacturer: "Maruti Suzuki", model: "Alto 800", variant: "LXi", category: "Hatchback", fuel: "Petrol", baseValue: 32000 },
    { manufacturer: "Maruti Suzuki", model: "WagonR", variant: "VXi", category: "Hatchback", fuel: "CNG", baseValue: 38000 },
    { manufacturer: "Maruti Suzuki", model: "Swift Dzire", variant: "VDi", category: "Sedan", fuel: "Diesel", baseValue: 48000 },
    { manufacturer: "Hyundai", model: "Santro Xing", variant: "GL", category: "Hatchback", fuel: "Petrol", baseValue: 34000 },
    { manufacturer: "Hyundai", model: "i10", variant: "Magna", category: "Hatchback", fuel: "Petrol", baseValue: 42000 },
    { manufacturer: "Hyundai", model: "Accent", variant: "GLE", category: "Sedan", fuel: "CNG", baseValue: 44000 },
    { manufacturer: "Tata Motors", model: "Indica Vista", variant: "LS", category: "Hatchback", fuel: "Diesel", baseValue: 36000 },
    { manufacturer: "Tata Motors", model: "Indigo eCS", variant: "LX", category: "Sedan", fuel: "Diesel", baseValue: 45000 },
    { manufacturer: "Mahindra", model: "Scorpio", variant: "SLX", category: "SUV", fuel: "Diesel", baseValue: 78000 },
    { manufacturer: "Mahindra", model: "Bolero", variant: "SLE", category: "MUV", fuel: "Diesel", baseValue: 68000 },
    { manufacturer: "Honda", model: "City", variant: "ZX", category: "Sedan", fuel: "Petrol", baseValue: 55000 },
    { manufacturer: "Toyota", model: "Innova", variant: "G4", category: "MUV", fuel: "Diesel", baseValue: 92000 },
    { manufacturer: "Chevrolet", model: "Beat", variant: "LT", category: "Hatchback", fuel: "Diesel", baseValue: 31000 },
    { manufacturer: "Ford", model: "Figo", variant: "Titanium", category: "Hatchback", fuel: "Diesel", baseValue: 39000 },
    { manufacturer: "Volkswagen", model: "Polo", variant: "Comfortline", category: "Hatchback", fuel: "Diesel", baseValue: 52000 },
    { manufacturer: "Ashok Leyland", model: "Dost", variant: "LS", category: "Commercial", fuel: "Diesel", baseValue: 84000 },
  ];

  const rtoPrefixes: Record<string, string> = {
    Ahmedabad: "GJ-01",
    Surat: "GJ-05",
    Vadodara: "GJ-06",
    Rajkot: "GJ-03",
    Gandhinagar: "GJ-18",
    Bhavnagar: "GJ-04",
    Jamnagar: "GJ-10",
    Anand: "GJ-23",
    Bharuch: "GJ-16",
    Mehsana: "GJ-02",
    Valsad: "GJ-15",
    Kutch: "GJ-12",
    Morbi: "GJ-36",
    Junagadh: "GJ-11",
    Navsari: "GJ-21",
  };

  const customers: Array<{ id: string; code: string; name: string; mobile: string; loc: (typeof locationRecords)[number] }> = [];
  for (let i = 0; i < 78; i++) {
    const loc = locationRecords[i % locationRecords.length];
    const fName = firstNames[i % firstNames.length];
    const lName = lastNames[(i * 3) % lastNames.length];
    const fullName = `${fName} ${lName}`;
    const mobile = `98${25 + (i % 70)}${String(100100 + i * 731).slice(0, 6)}`;
    const cType = i % 15 === 0 ? "Fleet" : i % 9 === 0 ? "Dealer" : "Individual";
    const cust = await prisma.customer.create({
      data: {
        customerCode: `CUS-${String(i + 1).padStart(4, "0")}`,
        name: fullName,
        primaryMobile: mobile,
        altMobile: i % 3 === 0 ? `99${10 + (i % 80)}${String(200200 + i * 313).slice(0, 6)}` : null,
        email: i % 2 === 0 ? `${fName.toLowerCase()}.${lName.toLowerCase()}${i + 1}@example.in` : null,
        customerType: cType,
        state: "Gujarat",
        district: loc.district,
        city: loc.city,
        town: loc.town,
        area: loc.area,
        pinCode: loc.pinCode,
        fullAddress: `Plot ${12 + i}, ${loc.area ?? loc.city}, ${loc.city}, ${loc.district}, Gujarat - ${loc.pinCode}`,
        preferredContactMethod: i % 3 === 0 ? "WhatsApp" : "Phone Call",
        locationId: loc.id,
        notes: cType !== "Individual" ? "Repeat commercial / multi-vehicle partner in Gujarat." : null,
        createdAt: daysAgo(58 - (i % 55)),
      },
    });
    customers.push({ id: cust.id, code: cust.customerCode, name: cust.name, mobile: cust.primaryMobile, loc });
  }

  const salesTeam = [empSales1, empSales2, empSales3, empSales4];
  const stagePool = [
    "New", "New", "Assigned", "Assigned", "Contacted", "Interested",
    "Details Collected", "Inspection Required", "Quotation Given", "Negotiation",
    "Deal Confirmed", "Pickup Scheduled", "Vehicle Collected", "Documentation Pending",
    "Completed", "Completed", "Completed", "Completed", "Completed", "Lost", "Lost",
  ];
  const lostReasons = [
    "Price disagreement",
    "Customer not interested",
    "Vehicle already sold",
    "Customer unreachable",
    "Vehicle not eligible",
    "Duplicate enquiry",
    "Service area unavailable",
    "Customer postponed decision",
    "Other",
  ];

  // Track daily Meta lead counts per Ad so AdMetrics match CRM leads!
  const dailyAdLeadCounts: Record<string, number> = {};
  const createdLeads: Array<{
    id: string;
    leadCode: string;
    status: string;
    customerIdx: number;
    loc: (typeof locationRecords)[number];
    assignedEmpId: string | null;
    campaignId: string | null;
    enquiryDate: Date;
    vehicleTemplate: (typeof vehicleTemplates)[number];
    regNo: string;
    mfgYear: number;
    expectedPrice: number;
  }> = [];

  for (let i = 0; i < 120; i++) {
    // Re-use earlier customers for ~35% of leads to represent repeat enquiries + duplicates
    const customerIdx = i < 78 ? i : (i - 78) * 2;
    const cust = customers[customerIdx % customers.length];
    const ageDays = Math.floor((i * 58) / 120);
    const enquiryDate = daysAgo(ageDays, 9 + (i % 9), (i * 13) % 60);
    const dateKey = enquiryDate.toISOString().slice(0, 10);

    // ~72% Meta leads (Facebook/Instagram), ~28% WhatsApp/Website/Phone/Referral/Organic
    const isMeta = i % 10 < 7;
    let sourceName = "Facebook";
    let campaignId: string | null = null;
    let adSetId: string | null = null;
    let adId: string | null = null;
    let formName: string | null = null;
    let metaLeadId: string | null = null;

    if (isMeta) {
      const cmp = campaigns[i % campaigns.length];
      const adSet = cmp.adSets[i % cmp.adSets.length];
      const ad = adSet.ads[i % adSet.ads.length];
      campaignId = cmp.id;
      adSetId = adSet.id;
      adId = ad.id;
      sourceName = ad.platform === "Instagram" ? "Instagram" : "Facebook";
      formName = `${cmp.name.slice(0, 22)} Instant Form`;
      metaLeadId = `META-LD-${880000 + i}`;
      const metricKey = `${dateKey}|${ad.id}`;
      dailyAdLeadCounts[metricKey] = (dailyAdLeadCounts[metricKey] ?? 0) + 1;
    } else {
      const nonMeta = ["WhatsApp", "Website", "Phone Calls", "Referrals", "Organic Sources", "Other Sources"];
      sourceName = nonMeta[i % nonMeta.length];
    }

    // Assign stage realistically (more recent leads are earlier stages, older leads progressed further)
    let status = stagePool[i % stagePool.length];
    if (ageDays <= 2 && i % 4 === 0) status = "New";
    if (ageDays <= 4 && i % 5 === 1) status = "Assigned";
    if (i >= 116) {
      // Deliberate duplicate enquiries matching customer mobile/reg
      status = i % 2 === 0 ? "New" : "Contacted";
    }

    const isUnassigned = status === "New" && i % 3 === 0;
    const assignedEmp = isUnassigned ? null : salesTeam[i % salesTeam.length];

    const vTpl = vehicleTemplates[i % vehicleTemplates.length];
    const rto = rtoPrefixes[cust.loc.district] ?? "GJ-01";
    const series = String.fromCharCode(65 + (i % 20)) + String.fromCharCode(65 + ((i * 3) % 20));
    const regNo = i >= 116
      ? `${rto}-${series}-${1000 + ((i - 116) * 2)}`
      : `${rto}-${series}-${1000 + i * 7}`;
    const mfgYear = 2006 + (i % 10);
    const expectedPrice = vTpl.baseValue + (mfgYear - 2006) * 2200;

    const stageIdxMap: Record<string, number> = {
      New: 0, Assigned: 1, Contacted: 2, Interested: 3, "Details Collected": 4,
      "Inspection Required": 5, "Quotation Given": 6, Negotiation: 7, "Deal Confirmed": 8,
      "Pickup Scheduled": 9, "Vehicle Collected": 10, "Documentation Pending": 11, Completed: 12, Lost: 13,
    };
    const sIdx = stageIdxMap[status];

    const qualificationStatus =
      status === "Lost"
        ? "Disqualified"
        : sIdx >= 4
        ? "Qualified"
        : sIdx >= 2
        ? "Pending Verification"
        : "Unverified";

    const priority =
      status === "Lost"
        ? "Cold"
        : sIdx >= 6 || i % 4 === 0
        ? "Hot"
        : sIdx >= 2
        ? "Warm"
        : "Cold";

    const intentScore =
      status === "Lost" ? 20 : Math.min(98, 25 + sIdx * 6 + (i % 3) * 5);
    const intentCategory =
      intentScore >= 70 ? "High Intent" : intentScore >= 40 ? "Medium Intent" : "Low Intent";

    const leadCode = `LD-2026-${String(i + 1).padStart(4, "0")}`;
    const isDuplicate = i >= 116;

    const lead = await prisma.lead.create({
      data: {
        leadCode,
        customerId: cust.id,
        leadSourceId: sources[sourceName],
        campaignId,
        adSetId,
        adId,
        formName,
        metaLeadId,
        firstTouchSource: sourceName,
        firstTouchCampaign: campaignId ? campaigns.find((c) => c.id === campaignId)?.name ?? null : null,
        firstTouchAd: adId,
        lastTouchSource: i % 7 === 0 ? "WhatsApp" : sourceName,
        lastTouchCampaign: campaignId ? campaigns.find((c) => c.id === campaignId)?.name ?? null : null,
        lastTouchAd: adId,
        attributionMethod: i % 5 === 0 ? "Last-Touch" : "First-Touch",
        attributionConfidence: isMeta ? "Confirmed" : "Self-Reported",
        enquiryDate,
        expectedSellingPrice: expectedPrice,
        quotationAmount: sIdx >= 6 && status !== "Lost" ? expectedPrice - 3500 : null,
        assignedEmployeeId: assignedEmp?.id ?? null,
        createdById: empAdmin.id,
        assignedById: assignedEmp ? empManager.id : null,
        priority,
        status,
        lostReason: status === "Lost" ? lostReasons[i % lostReasons.length] : null,
        qualificationStatus,
        intentScore,
        intentCategory,
        lastContactAt: sIdx >= 2 ? daysAgo(Math.max(0, ageDays - 1), 15, 0) : null,
        nextFollowUpAt:
          status !== "Completed" && status !== "Lost"
            ? i % 9 === 0
              ? daysAgo(2, 11, 0) // overdue
              : daysFromNow((i % 5) + 1, 11, 0)
            : null,
        customerNotes: `Enquired about scrapping ${mfgYear} ${vTpl.manufacturer} ${vTpl.model} (${vTpl.fuel}) in ${cust.loc.city}.`,
        internalRemarks: isDuplicate
          ? "Potential duplicate detected — same mobile/registration found in existing records."
          : sIdx >= 6
          ? "RC checked, customer wants doorstep pickup."
          : null,
        isDuplicate,
        duplicateOfLeadId: isDuplicate ? createdLeads[(i - 116) * 2]?.id ?? null : null,
        createdAt: enquiryDate,
        updatedAt: daysAgo(Math.max(0, ageDays - 1), 16, 0),
      },
    });

    createdLeads.push({
      id: lead.id,
      leadCode: lead.leadCode,
      status,
      customerIdx,
      loc: cust.loc,
      assignedEmpId: assignedEmp?.id ?? null,
      campaignId,
      enquiryDate,
      vehicleTemplate: vTpl,
      regNo,
      mfgYear,
      expectedPrice,
    });

    // Activity Log for lead creation & progression
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: "Lead Created",
        newStatus: "New",
        summary: `Lead received via ${sourceName} for ${cust.loc.city}`,
        performedById: empAdmin.id,
        createdAt: enquiryDate,
      },
    });

    if (assignedEmp) {
      await prisma.leadAssignment.create({
        data: {
          leadId: lead.id,
          toEmployeeId: assignedEmp.id,
          assignedById: empManager.id,
          reason: `Regional territory assignment (${cust.loc.district})`,
          createdAt: new Date(enquiryDate.getTime() + 1000 * 60 * 30),
        },
      });
      if (status !== "New") {
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            activityType: "Status Change",
            oldStatus: "New",
            newStatus: status,
            summary: `Progressed to ${status}${status === "Lost" ? ` (${lostReasons[i % lostReasons.length]})` : ""}`,
            performedById: assignedEmp.id,
            createdAt: new Date(enquiryDate.getTime() + 1000 * 60 * 60 * 4),
          },
        });
      }
    }
  }

  // 7. Daily AdMetrics over last 60 days — reconciling metaLeads with createdLeads!
  for (let d = 0; d < 60; d++) {
    const dayDate = daysAgo(d, 0, 0);
    const dateKey = dayDate.toISOString().slice(0, 10);
    for (let cIdx = 0; cIdx < campaigns.length; cIdx++) {
      const cmp = campaigns[cIdx];
      for (const adSet of cmp.adSets) {
        for (const ad of adSet.ads) {
          const metricKey = `${dateKey}|${ad.id}`;
          const crmMetaLeads = dailyAdLeadCounts[metricKey] ?? 0;
          const r = seededRand(d * 100 + cIdx * 7 + ad.id.charCodeAt(3));
          const impressions = Math.round(900 + r * 2400 + crmMetaLeads * 450);
          const reach = Math.round(impressions * (0.64 + r * 0.16));
          const linkClicks = Math.round(impressions * (0.016 + r * 0.018));
          const allClicks = Math.round(linkClicks * (1.22 + r * 0.15));
          const landingPageViews = Math.round(linkClicks * 0.74);
          const spend = Math.round(240 + r * 420 + crmMetaLeads * 210);

          await prisma.adMetric.create({
            data: {
              date: dayDate,
              campaignId: cmp.id,
              adSetId: adSet.id,
              adId: ad.id,
              platform: ad.platform,
              spend,
              impressions,
              reach,
              linkClicks,
              allClicks,
              landingPageViews,
              metaLeads: crmMetaLeads,
            },
          });
        }
      }
    }
  }

  // 8. Follow-ups (65+ records across Today, Upcoming, Overdue, Completed, Missed)
  const fuTypes = [
    "Phone call", "WhatsApp message", "Customer visit", "Vehicle inspection",
    "Price negotiation", "Document collection", "Pickup coordination", "Other",
  ];
  let fuCounter = 1;
  for (let i = 0; i < createdLeads.length; i += 2) {
    const ld = createdLeads[i];
    if (!ld.assignedEmpId) continue;
    const cust = customers[ld.customerIdx % customers.length];
    const mod = fuCounter % 6;
    const isCompleted = ld.status === "Completed" || mod === 0;
    const isOverdue = !isCompleted && (mod === 1 || mod === 2);
    const isToday = !isCompleted && mod === 3;
    const isMissed = !isCompleted && mod === 4 && ld.status !== "Lost";

    const fuDate = isCompleted
      ? daysAgo((fuCounter % 15) + 1)
      : isOverdue
      ? daysAgo((fuCounter % 4) + 1)
      : isToday
      ? daysFromNow(0, 14, 30)
      : daysFromNow((fuCounter % 7) + 1);

    await prisma.followUp.create({
      data: {
        followUpCode: `FU-${String(fuCounter).padStart(4, "0")}`,
        leadId: ld.id,
        customerId: cust.id,
        assignedEmployeeId: ld.assignedEmpId,
        followUpDate: fuDate,
        followUpTime: `${10 + (fuCounter % 8)}:30`,
        type: fuTypes[fuCounter % fuTypes.length],
        priority: fuCounter % 3 === 0 ? "High" : fuCounter % 2 === 0 ? "Medium" : "Low",
        status: isCompleted ? "Completed" : isMissed ? "Missed" : "Pending",
        notes: `Follow-up for ${ld.vehicleTemplate.manufacturer} ${ld.vehicleTemplate.model} (${ld.regNo}) in ${ld.loc.city}.`,
        contactResult: isCompleted ? "Connected — customer confirmed vehicle details" : null,
        customerResponse: isCompleted ? "Interested in doorstep inspection & final quote" : null,
        nextAction: isCompleted ? "Schedule inspection" : "Call customer and confirm appointment",
        completedAt: isCompleted ? fuDate : null,
      },
    });
    fuCounter++;
  }

  // 9. Vehicles (46+), Inspections, Quotations, Pickups, Documents, Inventory, Transactions, Expenses, Revenues, Payments
  const eligibleLeads = createdLeads.filter((l) =>
    [
      "Details Collected", "Inspection Required", "Quotation Given", "Negotiation",
      "Deal Confirmed", "Pickup Scheduled", "Vehicle Collected", "Documentation Pending", "Completed",
    ].includes(l.status)
  );

  let vehCount = 0;
  let inspCount = 0;
  let qtCount = 0;
  let pkpCount = 0;
  let docCount = 0;
  let invCount = 0;
  let txnCount = 0;
  let expCount = 0;
  let revCount = 0;
  let payCount = 0;

  for (let i = 0; i < eligibleLeads.length; i++) {
    const ld = eligibleLeads[i];
    const cust = customers[ld.customerIdx % customers.length];
    vehCount++;
    const purchaseStatusMap: Record<string, string> = {
      "Details Collected": "Enquiry",
      "Inspection Required": "Enquiry",
      "Quotation Given": "Quoted",
      Negotiation: "Quoted",
      "Deal Confirmed": "Confirmed",
      "Pickup Scheduled": "Confirmed",
      "Vehicle Collected": "Collected",
      "Documentation Pending": "Collected",
      Completed: "Completed",
    };
    const isCollectedOrBeyond = ["Vehicle Collected", "Documentation Pending", "Completed"].includes(ld.status);
    const isCompleted = ld.status === "Completed";

    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleCode: `VEH-${String(vehCount).padStart(4, "0")}`,
        customerId: cust.id,
        leadId: ld.id,
        registrationNumber: ld.regNo,
        manufacturer: ld.vehicleTemplate.manufacturer,
        model: ld.vehicleTemplate.model,
        variant: ld.vehicleTemplate.variant,
        manufacturingYear: ld.mfgYear,
        category: ld.vehicleTemplate.category,
        fuelType: ld.vehicleTemplate.fuel,
        vehicleCondition: i % 3 === 0 ? "Old / End-of-Life" : i % 3 === 1 ? "Scrap / Non-Running" : "Accident Damaged",
        runningCondition: i % 2 === 0 ? "Running" : "Non-Running",
        engineCondition: i % 2 === 0 ? "Fair" : "Seized / Poor",
        bodyCondition: i % 3 === 0 ? "Minor Rust" : "Heavy Rust / Dented",
        locationState: "Gujarat",
        locationDistrict: ld.loc.district,
        locationCity: ld.loc.city,
        locationArea: ld.loc.area,
        locationPinCode: ld.loc.pinCode,
        ownershipDetails: i % 4 === 0 ? "2nd Owner (Clear Title)" : "1st Owner",
        rcAvailable: i % 7 === 0 ? "Lost/Duplicate" : "Yes",
        insuranceStatus: "Expired",
        documentVerificationStatus: isCompleted ? "Verified" : isCollectedOrBeyond ? "In Review" : "Pending",
        purchaseStatus: purchaseStatusMap[ld.status] ?? "Enquiry",
        additionalDetails: `Gujarat RTO ${ld.regNo.slice(0, 5)} vehicle inspected under Movish Group scrapping checklist.`,
        createdAt: ld.enquiryDate,
      },
    });

    // Inspections for Inspection Required & beyond
    const needsInspection = ld.status !== "Details Collected";
    const estimatedVal = Math.round(ld.expectedPrice * 0.92);
    if (needsInspection) {
      inspCount++;
      await prisma.inspection.create({
        data: {
          inspectionCode: `INSP-${String(inspCount).padStart(4, "0")}`,
          vehicleId: vehicle.id,
          inspectionDate: new Date(ld.enquiryDate.getTime() + 1000 * 60 * 60 * 24),
          inspectorId: empOps.id,
          vehicleCondition: vehicle.vehicleCondition,
          engineCondition: vehicle.engineCondition,
          bodyCondition: vehicle.bodyCondition,
          tyreCondition: i % 2 === 0 ? "Worn (30%)" : "Scrap",
          batteryCondition: i % 3 === 0 ? "Working" : "Dead",
          accidentHistory: i % 5 === 0 ? "Front bumper & fender impact recorded" : "No major structural accident",
          estimatedPurchaseValue: estimatedVal,
          notes: `Physical scrap weight & recoverable parts assessed in ${ld.loc.city}.`,
          result: "Eligible",
        },
      });
    }

    // Quotations for Quotation Given & beyond
    const hasQuote = [
      "Quotation Given", "Negotiation", "Deal Confirmed", "Pickup Scheduled",
      "Vehicle Collected", "Documentation Pending", "Completed",
    ].includes(ld.status);

    const agreedPrice = Math.round(estimatedVal * 0.98);
    if (hasQuote) {
      qtCount++;
      const isNegotiated = ["Negotiation", "Deal Confirmed", "Pickup Scheduled", "Vehicle Collected", "Documentation Pending", "Completed"].includes(ld.status);
      const isConfirmed = ["Deal Confirmed", "Pickup Scheduled", "Vehicle Collected", "Documentation Pending", "Completed"].includes(ld.status);

      await prisma.quotation.create({
        data: {
          quotationCode: `QT-${String(qtCount).padStart(4, "0")}`,
          vehicleId: vehicle.id,
          leadId: ld.id,
          customerId: cust.id,
          revisionNumber: 1,
          offeredPurchasePrice: estimatedVal - 3000,
          quotationDate: new Date(ld.enquiryDate.getTime() + 1000 * 60 * 60 * 36),
          validityDate: daysFromNow(14),
          preparedById: ld.assignedEmpId ?? empSales1.id,
          approvalStatus: "Approved",
          approvedById: empManager.id,
          customerAcceptanceStatus: isNegotiated ? "Negotiating" : "Pending",
          negotiationNotes: "Initial quote shared with customer via WhatsApp & phone.",
        },
      });

      if (isNegotiated) {
        qtCount++;
        await prisma.quotation.create({
          data: {
            quotationCode: `QT-${String(qtCount).padStart(4, "0")}`,
            vehicleId: vehicle.id,
            leadId: ld.id,
            customerId: cust.id,
            revisionNumber: 2,
            offeredPurchasePrice: agreedPrice,
            quotationDate: new Date(ld.enquiryDate.getTime() + 1000 * 60 * 60 * 48),
            validityDate: daysFromNow(10),
            preparedById: ld.assignedEmpId ?? empSales1.id,
            approvalStatus: isConfirmed ? "Approved" : "Pending Approval",
            approvedById: isConfirmed ? empManager.id : null,
            customerAcceptanceStatus: isConfirmed ? "Accepted" : "Negotiating",
            negotiationNotes: isConfirmed ? "Revised price accepted by customer; pickup authorized." : "Customer requested ₹2,000 extra for towing waiver.",
          },
        });
      }
    }

    // Pickups for Deal Confirmed & beyond
    const hasPickup = ["Deal Confirmed", "Pickup Scheduled", "Vehicle Collected", "Documentation Pending", "Completed"].includes(ld.status);
    const pickupExp = 1800 + (i % 4) * 400;
    if (hasPickup) {
      pkpCount++;
      const pkpStatus =
        ld.status === "Deal Confirmed"
          ? "Not Scheduled"
          : ld.status === "Pickup Scheduled"
          ? i % 2 === 0 ? "Scheduled" : "In Transit"
          : "Collected";

      await prisma.pickup.create({
        data: {
          pickupCode: `PKP-${String(pkpCount).padStart(4, "0")}`,
          vehicleId: vehicle.id,
          customerId: cust.id,
          pickupAddress: `${ld.loc.area ?? ld.loc.city}, ${ld.loc.city}, ${ld.loc.district}`,
          district: ld.loc.district,
          city: ld.loc.city,
          scheduledDate: pkpStatus === "Not Scheduled" ? null : daysAgo(Math.max(0, 10 - (i % 8))),
          scheduledTime: "11:30 AM",
          assignedDriver: i % 2 === 0 ? "Mahesh Parmar (GJ-01-AT-4412)" : "Suresh Jadeja (GJ-05-BT-7821)",
          assignedVendor: i % 3 === 0 ? "Movish In-House Flatbed" : "Gujarat Recovery Cranes",
          transportationDetails: "Hydraulic Flatbed Tow Truck",
          pickupStatus: pkpStatus,
          actualPickupDate: pkpStatus === "Collected" ? new Date(ld.enquiryDate.getTime() + 1000 * 60 * 60 * 72) : null,
          pickupExpenses: pkpStatus === "Collected" ? pickupExp : 0,
          remarks: pkpStatus === "Collected" ? "Vehicle delivered safely to Movish Yard." : "Awaiting dispatch confirmation.",
        },
      });
    }

    // Documents checklist for Deal Confirmed & beyond
    if (hasPickup) {
      const docTypesToCreate = [
        "Registration Certificate",
        "Ownership verification",
        "Identity verification",
        "Vehicle handover documentation",
        "Applicable scrapping certificates",
      ];
      for (const dt of docTypesToCreate) {
        docCount++;
        const verified =
          isCompleted || (isCollectedOrBeyond && dt !== "Applicable scrapping certificates");
        await prisma.document.create({
          data: {
            documentCode: `DOC-${String(docCount).padStart(4, "0")}`,
            vehicleId: vehicle.id,
            documentType: dt,
            fileName: `${vehicle.vehicleCode}_${dt.replace(/\s+/g, "_")}.pdf`,
            fileReference: `/uploads/demo-ref/${vehicle.vehicleCode}/${dt.toLowerCase().replace(/\s+/g, "-")}.pdf`,
            uploadDate: new Date(ld.enquiryDate.getTime() + 1000 * 60 * 60 * 75),
            uploadedById: empOps.id,
            verificationStatus: verified ? "Verified" : "Pending",
            verificationRemarks: verified
              ? "Verified against RTO & owner KYC"
              : "Pending legal RVSF scrapping certificate issuance",
          },
        });
      }
    }

    // Inventory & Transactions for Collected & Completed vehicles
    if (isCollectedOrBeyond) {
      invCount++;
      const procStatuses = ["Awaiting Documentation", "Ready for Processing", "Processing Started", "Dismantled", "Materials Recorded"];
      const realizationVal = isCompleted
        ? Math.round(agreedPrice * 1.62 + (i % 5) * 2400)
        : 0;

      await prisma.inventory.create({
        data: {
          inventoryCode: `INV-${String(invCount).padStart(4, "0")}`,
          vehicleId: vehicle.id,
          collectionDate: new Date(ld.enquiryDate.getTime() + 1000 * 60 * 60 * 72),
          currentLocation: ld.loc.yardLocation ?? "Movish Yard 1 — Naroda",
          storageLocation: `Bay-${(invCount % 12) + 1}`,
          processingStatus: isCompleted
            ? "Completed"
            : ld.status === "Documentation Pending"
            ? "Awaiting Documentation"
            : procStatuses[invCount % procStatuses.length],
          estimatedValue: Math.round(agreedPrice * 1.25),
          actualRealizationValue: realizationVal,
          partsJson: JSON.stringify([
            { part: "Steel Shell & Chassis Scrap", qty: "720 kg", value: Math.round(agreedPrice * 0.72) },
            { part: "Engine Block & Alloy Parts", qty: "1 unit", value: Math.round(agreedPrice * 0.35) },
            { part: "Copper Harness & Catalytic Converter", qty: "1 set", value: Math.round(agreedPrice * 0.21) },
          ]),
        },
      });

      // Transaction, Expenses, Revenues, Payments
      txnCount++;
      const transportExp = 800 + (i % 3) * 300;
      const labourExp = 1200;
      const processingExp = 1500;
      const otherExp = 500;
      const txnDate = new Date(ld.enquiryDate.getTime() + 1000 * 60 * 60 * 84);

      const txn = await prisma.transaction.create({
        data: {
          transactionCode: `TXN-${String(txnCount).padStart(4, "0")}`,
          leadId: ld.id,
          customerId: cust.id,
          vehicleId: vehicle.id,
          transactionDate: txnDate,
          vehiclePurchaseAmount: agreedPrice,
          paymentStatus: isCompleted ? "Paid" : i % 2 === 0 ? "Partially Paid" : "Pending",
          paymentMethod: i % 2 === 0 ? "NEFT / IMPS" : "UPI / Bank Transfer",
          paymentReference: isCompleted ? `UTR-MOV-${260000 + txnCount}` : null,
          pickupExpense: pickupExp,
          transportationExpense: transportExp,
          labourExpense: labourExp,
          processingExpense: processingExp,
          otherExpenses: otherExp,
          realizationValue: realizationVal,
          transactionStatus: isCompleted ? "Completed" : "In Progress",
          remarks: isCompleted
            ? "Purchase settled, vehicle dismantled, and scrap/parts realized."
            : "Vehicle collected; awaiting final legal documentation & dismantling realization.",
        },
      });

      // Expense entries linked to transaction & vehicle (NOT double-counted in purchase cost)
      const expRows = [
        { category: "Transportation", amount: pickupExp + transportExp, notes: "Tow truck pickup & yard transit" },
        { category: "Labour", amount: labourExp, notes: "Dismantling & sorting crew" },
        { category: "Processing", amount: processingExp, notes: "Fluid draining & depollution" },
        { category: "Documentation", amount: otherExp, notes: "RTO deregistration & paperwork" },
      ];
      for (const er of expRows) {
        expCount++;
        await prisma.expense.create({
          data: {
            expenseCode: `EXP-${String(expCount).padStart(4, "0")}`,
            category: er.category,
            amount: er.amount,
            date: txnDate,
            transactionId: txn.id,
            vehicleId: vehicle.id,
            paymentMethod: "Company Account / Cash",
            reference: `EXP-REF-${expCount}`,
            enteredById: empAccounts.id,
            includedInPurchaseCost: false,
            notes: er.notes,
          },
        });
      }

      // Purchase Payment Record
      payCount++;
      await prisma.payment.create({
        data: {
          paymentCode: `PAY-${String(payCount).padStart(4, "0")}`,
          transactionId: txn.id,
          vehicleId: vehicle.id,
          direction: "Outbound",
          amount: isCompleted ? agreedPrice : Math.round(agreedPrice * 0.5),
          paymentDate: txnDate,
          paymentMethod: "IMPS",
          paymentReference: `IMPS-${89000 + payCount}`,
          status: isCompleted ? "Paid" : "Partially Paid",
          recordedById: empAccounts.id,
          notes: `Purchase payout to ${cust.name} for ${vehicle.registrationNumber}`,
        },
      });

      // Realized Revenue entries for Completed transactions
      if (isCompleted && realizationVal > 0) {
        const scrapSale = Math.round(realizationVal * 0.68);
        const partsSale = realizationVal - scrapSale;

        revCount++;
        await prisma.revenue.create({
          data: {
            revenueCode: `REV-${String(revCount).padStart(4, "0")}`,
            source: "Scrap material sales",
            vehicleId: vehicle.id,
            transactionId: txn.id,
            amount: scrapSale,
            date: new Date(txnDate.getTime() + 1000 * 60 * 60 * 48),
            buyer: "Saurashtra Induction Steels Pvt. Ltd.",
            paymentStatus: "Paid",
            notes: `Shredded ferrous & non-ferrous weight realization for ${vehicle.registrationNumber}`,
          },
        });

        revCount++;
        await prisma.revenue.create({
          data: {
            revenueCode: `REV-${String(revCount).padStart(4, "0")}`,
            source: "Reusable parts sales",
            vehicleId: vehicle.id,
            transactionId: txn.id,
            amount: partsSale,
            date: new Date(txnDate.getTime() + 1000 * 60 * 60 * 72),
            buyer: "Gujarat Auto Spares Mart, Ahmedabad",
            paymentStatus: "Paid",
            notes: `Verified reusable gearbox, alternator, and alloy assemblies from ${vehicle.model}`,
          },
        });
      }
    }
  }

  // General Operational Expenses (Marketing, Admin, Storage)
  const generalExpenses = [
    { category: "Marketing", amount: 45000, notes: "Meta Ads wallet recharge — Ahmedabad & Surat campaigns", days: 25 },
    { category: "Storage", amount: 32000, notes: "Monthly Naroda GIDC scrap yard lease & security", days: 18 },
    { category: "Administrative expenses", amount: 18500, notes: "Office internet, CRM systems, and Gujarat RTO coordination", days: 10 },
    { category: "Marketing", amount: 38000, notes: "Meta Ads wallet recharge — Vadodara & Rajkot campaigns", days: 5 },
  ];
  for (const ge of generalExpenses) {
    expCount++;
    await prisma.expense.create({
      data: {
        expenseCode: `EXP-${String(expCount).padStart(4, "0")}`,
        category: ge.category,
        amount: ge.amount,
        date: daysAgo(ge.days),
        paymentMethod: "Corporate Current A/C",
        reference: `CORP-${expCount}`,
        enteredById: empAccounts.id,
        includedInPurchaseCost: false,
        notes: ge.notes,
      },
    });
  }

  // 10. Communication Logs
  const commTypes = ["Phone call", "WhatsApp", "Facebook lead form", "Instagram enquiry", "Email", "SMS", "Internal note"];
  for (let i = 0; i < 40; i++) {
    const ld = createdLeads[i * 2];
    const cust = customers[ld.customerIdx % customers.length];
    await prisma.communicationLog.create({
      data: {
        commCode: `COM-${String(i + 1).padStart(4, "0")}`,
        customerId: cust.id,
        leadId: ld.id,
        communicationType: commTypes[i % commTypes.length],
        direction: i % 3 === 0 ? "Inbound" : "Outbound",
        timestamp: daysAgo(i % 20, 11 + (i % 6), 15),
        employeeId: ld.assignedEmpId ?? empSales1.id,
        summary: `Discussed ${ld.vehicleTemplate.manufacturer} ${ld.vehicleTemplate.model} (${ld.regNo}) scrap valuation & RC verification.`,
        outcome: i % 4 === 0 ? "Callback Requested" : "Positive — Proceeding",
        nextAction: "Send quote / confirm inspection time",
      },
    });
  }

  // 11. Notifications
  const notifSeeds = [
    { title: "New High-Intent Lead Received", description: "New scrap enquiry from Ahmedabad via Facebook Instant Form awaiting first call.", category: "New lead received", relatedModule: "leads", targetRoleCode: "MANAGER" },
    { title: "Overdue Follow-ups Require Attention", description: "Multiple assigned leads have overdue follow-ups scheduled in Surat & Ahmedabad.", category: "Follow-up overdue", relatedModule: "followups", targetRoleCode: "SALES_EXECUTIVE" },
    { title: "Quotation Pending Manager Approval", description: "Revised quotation awaits review for Gujarat RTO vehicle negotiation.", category: "Quotation generated", relatedModule: "vehicles", targetRoleCode: "MANAGER" },
    { title: "Vehicle Collected — Pending Scrapping Certificate", description: "Collected vehicle in Naroda Yard requires legal RVSF certificate upload.", category: "Documentation pending", relatedModule: "vehicles", targetRoleCode: "OPERATIONS_EXECUTIVE" },
    { title: "Meta Ads Account Setup Required", description: "Connect authorized Meta Business credentials in Settings to enable live campaign sync.", category: "Meta synchronization failure", relatedModule: "settings", targetRoleCode: "SUPER_ADMIN" },
    { title: "Duplicate Lead Warning Flagged", description: "Potential duplicate enquiries matched on mobile number and Gujarat registration plate.", category: "New lead received", relatedModule: "leads", targetRoleCode: "ADMIN" },
  ];
  for (let i = 0; i < notifSeeds.length; i++) {
    await prisma.notification.create({
      data: {
        notificationCode: `NTF-${String(i + 1).padStart(4, "0")}`,
        ...notifSeeds[i],
        isRead: i > 3,
        createdAt: daysAgo(i, 9, 0),
      },
    });
  }

  // 12. Audit Logs & System Settings
  await prisma.auditLog.create({
    data: {
      actorUserId: createdUsers[0].id,
      actorName: empOwner.fullName,
      action: "SYSTEM_INITIALIZED",
      entityType: "System",
      entityId: "MOVISH-BMS-1.0",
      summary: "Movish Group Business Management System initialized with Gujarat operations dataset.",
    },
  });

  const defaultSettings = [
    {
      key: "company_profile",
      category: "Company",
      valueJson: JSON.stringify({
        companyName: "Movish Group",
        legalName: "Movish Group Auto Recycling & Scrap Solutions Pvt. Ltd.",
        state: "Gujarat",
        city: "Ahmedabad",
        headOfficeAddress: "Plot 42, Naroda GIDC Phase II, Ahmedabad, Gujarat - 382330",
        phone: "+91 79 2281 4500",
        email: "operations@movishgroup.in",
        gstNumber: "24AABCM8492K1Z5",
        currency: "INR (₹)",
        dateFormat: "DD MMM YYYY",
      }),
    },
    {
      key: "meta_integration",
      category: "Integrations",
      valueJson: JSON.stringify({
        status: "Not Connected",
        appId: "",
        adAccountId: "",
        businessId: "",
        syncFrequency: "Every 6 Hours",
        lastSyncAt: null,
        attributionModel: "First-Touch & Last-Touch Dual Tracking",
        attributionWindowDays: 7,
        clickMetricPreference: "link_clicks",
        note: "Phase 3 Integration ready: provide authorized Meta Marketing API credentials to activate live sync.",
      }),
    },
    {
      key: "whatsapp_integration",
      category: "Integrations",
      valueJson: JSON.stringify({
        status: "Not Connected",
        phoneNumberId: "",
        wabaId: "",
        autoAcknowledgement: false,
        note: "Phase 4 Integration ready: configure WhatsApp Business Cloud API credentials when authorized.",
      }),
    },
    {
      key: "lead_scoring_rules",
      category: "Configuration",
      valueJson: JSON.stringify({
        respondedToFirstCall: 15,
        vehicleDetailsProvided: 15,
        withinGujaratServiceArea: 15,
        rcDocumentationAvailable: 15,
        willingToProceed: 15,
        quotationAcceptedOrNegotiating: 15,
        inspectionAgreedOrCompleted: 10,
        highIntentThreshold: 70,
        mediumIntentThreshold: 40,
      }),
    },
    {
      key: "followup_sla",
      category: "Configuration",
      valueJson: JSON.stringify({
        firstResponseTargetMinutes: 30,
        staleLeadAlertDays: 3,
        negotiationEscalationDays: 5,
        quotationValidityDays: 14,
      }),
    },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.create({ data: s });
  }

  console.log(
    `Seed complete: ${campaigns.length} campaigns, ${createdLeads.length} leads, ${customers.length} customers, ${vehCount} vehicles, ${txnCount} transactions, ${fuCounter - 1} follow-ups.`
  );
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
