import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Resets the database to a clean production baseline with zero dummy business records,
 * retaining only system roles, RBAC permissions, Gujarat reference locations,
 * lead source definitions, default settings, and the primary Super Admin account.
 */
async function main() {
  console.log("Resetting Movish Group BMS to clean zero-dummy-data baseline...");

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
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.leadSource.deleteMany();
  await prisma.location.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.systemSetting.deleteMany();

  // 1. Roles
  const roleData = [
    { code: "SUPER_ADMIN", name: "Super Admin / Business Owner", description: "Complete access to entire platform, financials, audit logs, roles, settings, and exports." },
    { code: "ADMIN", name: "Admin", description: "Manage customers, leads, vehicles, operations, campaigns, and permitted users." },
    { code: "MANAGER", name: "Manager", description: "Assign leads, monitor team activity, review quotations, and track pickups." },
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

  // 2. Permissions & Role Matrix
  const permissionData = [
    { code: "dashboard:view", module: "Dashboard", action: "View", description: "View business overview dashboard" },
    { code: "meta_ads:view", module: "Meta Ads", action: "View", description: "View Meta advertising analytics" },
    { code: "meta_ads:manage", module: "Meta Ads", action: "Manage", description: "Create and manage campaigns, ad sets, ads, and metrics" },
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

  // 3. Clean Role Accounts (1 per role, 0 dummy business records)
  const defaultPassHash = hashPassword("Movish@2026");
  const roleUsersSeed = [
    { code: "EMP-001", name: "Movish Owner", email: "owner@movishgroup.in", mobile: "9825000001", roleCode: "SUPER_ADMIN", city: "Ahmedabad" },
    { code: "EMP-002", name: "Movish Admin", email: "admin@movishgroup.in", mobile: "9825000002", roleCode: "ADMIN", city: "Ahmedabad" },
    { code: "EMP-003", name: "Movish Manager", email: "manager@movishgroup.in", mobile: "9825000003", roleCode: "MANAGER", city: "Ahmedabad" },
    { code: "EMP-004", name: "Movish Sales Executive", email: "sales@movishgroup.in", mobile: "9825000004", roleCode: "SALES_EXECUTIVE", city: "Ahmedabad" },
    { code: "EMP-005", name: "Movish Marketing Executive", email: "marketing@movishgroup.in", mobile: "9825000005", roleCode: "MARKETING_EXECUTIVE", city: "Ahmedabad" },
    { code: "EMP-006", name: "Movish Operations Executive", email: "operations@movishgroup.in", mobile: "9825000006", roleCode: "OPERATIONS_EXECUTIVE", city: "Ahmedabad" },
    { code: "EMP-007", name: "Movish Accounts Executive", email: "accounts@movishgroup.in", mobile: "9825000007", roleCode: "ACCOUNTS_EXECUTIVE", city: "Ahmedabad" },
  ];

  let ownerUserId = "";
  let ownerName = "";
  for (const ru of roleUsersSeed) {
    const emp = await prisma.employee.create({
      data: {
        employeeCode: ru.code,
        fullName: ru.name,
        mobile: ru.mobile,
        email: ru.email,
        roleId: roles[ru.roleCode],
        joiningDate: new Date(),
        assignedDistrict: "Ahmedabad",
        assignedCity: ru.city,
        accountStatus: "Active",
      },
    });
    const usr = await prisma.user.create({
      data: {
        email: ru.email,
        passwordHash: defaultPassHash,
        name: ru.name,
        roleId: roles[ru.roleCode],
        employeeId: emp.id,
        isActive: true,
      },
    });
    if (ru.roleCode === "SUPER_ADMIN") {
      ownerUserId = usr.id;
      ownerName = usr.name;
    }
  }
  const ownerUser = { id: ownerUserId, name: ownerName };

  // 4. Gujarat Reference Locations
  const gujaratLocations = [
    { district: "Ahmedabad", city: "Ahmedabad", town: "Naroda", area: "Naroda GIDC", pinCode: "382330", yardLocation: "Movish Yard 1 — Naroda" },
    { district: "Surat", city: "Surat", town: "Sachin", area: "Sachin GIDC", pinCode: "394230", yardLocation: "Movish South Yard — Sachin" },
    { district: "Vadodara", city: "Vadodara", town: "Makarpura", area: "Makarpura GIDC", pinCode: "390010", yardLocation: "Movish Central Yard — Makarpura" },
    { district: "Rajkot", city: "Rajkot", town: "Shapar", area: "Shapar Veraval", pinCode: "360024", yardLocation: "Movish Saurashtra Yard — Shapar" },
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
  for (const loc of gujaratLocations) {
    await prisma.location.create({ data: { state: "Gujarat", ...loc, isServiceable: true } });
  }

  // 5. Standard Lead Sources
  const leadSources = [
    { name: "Facebook", category: "Paid Meta", sortOrder: 1 },
    { name: "Instagram", category: "Paid Meta", sortOrder: 2 },
    { name: "WhatsApp", category: "Direct Messaging", sortOrder: 3 },
    { name: "Website", category: "Owned Web", sortOrder: 4 },
    { name: "Phone Calls", category: "Inbound Call", sortOrder: 5 },
    { name: "Referrals", category: "Word of Mouth", sortOrder: 6 },
    { name: "Organic Sources", category: "Organic", sortOrder: 7 },
    { name: "Other Sources", category: "Other", sortOrder: 8 },
  ];
  for (const s of leadSources) {
    await prisma.leadSource.create({ data: s });
  }

  // 6. System Settings
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

  await prisma.auditLog.create({
    data: {
      actorUserId: ownerUser.id,
      actorName: ownerUser.name,
      action: "CLEAN_BASELINE_RESET",
      entityType: "System",
      entityId: "MOVISH-BMS",
      summary: "All dummy business records removed; system ready for end-to-end operational testing.",
    },
  });

  console.log("Clean baseline ready: 0 dummy leads/campaigns/customers/vehicles/transactions. Login: owner@movishgroup.in / Movish@2026");
}

main()
  .catch((err) => {
    console.error("Clean reset error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
