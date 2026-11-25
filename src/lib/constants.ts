export const MOVISH_BRAND = {
  name: "Movish Group",
  shortName: "MOVISH",
  tagline: "Business Management System — Gujarat Scrap Car Operations",
  currency: "INR",
  currencySymbol: "₹",
  region: "Gujarat, India",
  colors: {
    navy: "#1B3156",
    royal: "#0B5CA8",
    red: "#D62828",
    slate: "#3A4556",
  },
} as const;

export const LEAD_STAGES = [
  { key: "New", description: "Enquiry received", color: "bg-slate-100 text-slate-800 border-slate-300", dot: "#64748b" },
  { key: "Assigned", description: "Assigned to employee", color: "bg-sky-100 text-sky-800 border-sky-300", dot: "#0284c7" },
  { key: "Contacted", description: "Customer successfully contacted", color: "bg-blue-100 text-blue-800 border-blue-300", dot: "#2563eb" },
  { key: "Interested", description: "Customer shows interest", color: "bg-indigo-100 text-indigo-800 border-indigo-300", dot: "#4f46e5" },
  { key: "Details Collected", description: "Vehicle details collected", color: "bg-violet-100 text-violet-800 border-violet-300", dot: "#7c3aed" },
  { key: "Inspection Required", description: "Inspection required", color: "bg-purple-100 text-purple-800 border-purple-300", dot: "#9333ea" },
  { key: "Quotation Given", description: "Price quotation submitted", color: "bg-amber-100 text-amber-800 border-amber-300", dot: "#d97706" },
  { key: "Negotiation", description: "Price negotiation ongoing", color: "bg-orange-100 text-orange-800 border-orange-300", dot: "#ea580c" },
  { key: "Deal Confirmed", description: "Customer agrees", color: "bg-teal-100 text-teal-800 border-teal-300", dot: "#0d9488" },
  { key: "Pickup Scheduled", description: "Vehicle collection scheduled", color: "bg-cyan-100 text-cyan-800 border-cyan-300", dot: "#0891b2" },
  { key: "Vehicle Collected", description: "Vehicle collected", color: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "#059669" },
  { key: "Documentation Pending", description: "Required documentation pending", color: "bg-yellow-100 text-yellow-800 border-yellow-300", dot: "#ca8a04" },
  { key: "Completed", description: "Transaction successfully closed", color: "bg-green-100 text-green-800 border-green-300", dot: "#16a34a" },
  { key: "Lost", description: "Enquiry unsuccessful", color: "bg-red-100 text-red-800 border-red-300", dot: "#dc2626" },
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number]["key"];

export const STAGE_INDEX: Record<string, number> = Object.fromEntries(
  LEAD_STAGES.map((s, idx) => [s.key, idx])
);

export const LOST_REASONS = [
  "Customer not interested",
  "Price disagreement",
  "Vehicle already sold",
  "Customer unreachable",
  "Vehicle not eligible",
  "Duplicate enquiry",
  "Service area unavailable",
  "Customer postponed decision",
  "Other",
] as const;

export const LEAD_PRIORITIES = ["Hot", "Warm", "Cold"] as const;

export const FOLLOWUP_TYPES = [
  "Phone call",
  "WhatsApp message",
  "Customer visit",
  "Vehicle inspection",
  "Price negotiation",
  "Document collection",
  "Pickup coordination",
  "Other",
] as const;

export const PICKUP_STATUSES = [
  "Not Scheduled",
  "Scheduled",
  "In Transit",
  "Collected",
  "Cancelled",
] as const;

export const DOCUMENT_TYPES = [
  "Registration Certificate",
  "Ownership verification",
  "Identity verification",
  "Required authorization records",
  "Vehicle handover documentation",
  "Applicable scrapping certificates",
  "Other supporting documents",
] as const;

export const PROCESSING_STATUSES = [
  "Awaiting Inspection",
  "Inspected",
  "Awaiting Documentation",
  "Ready for Processing",
  "Processing Started",
  "Dismantled",
  "Materials Recorded",
  "Completed",
] as const;

export const EXPENSE_CATEGORIES = [
  "Vehicle purchase",
  "Transportation",
  "Labour",
  "Inspection",
  "Documentation",
  "Processing",
  "Storage",
  "Administrative expenses",
  "Marketing",
  "Other",
] as const;

export const REVENUE_SOURCES = [
  "Vehicle resale",
  "Scrap material sales",
  "Reusable parts sales",
  "Other realization sources",
] as const;

export const PAYMENT_STATUSES = [
  "Pending",
  "Partially Paid",
  "Paid",
  "Failed",
  "Cancelled",
] as const;

export const COMMUNICATION_TYPES = [
  "Phone call",
  "WhatsApp",
  "SMS",
  "Email",
  "Website enquiry",
  "Facebook lead form",
  "Instagram enquiry",
  "Internal note",
] as const;

export const VEHICLE_CATEGORIES = [
  "Hatchback",
  "Sedan",
  "SUV",
  "MUV",
  "Commercial",
  "Two-Wheeler",
  "Three-Wheeler",
] as const;

export const VEHICLE_MANUFACTURERS = [
  "Maruti Suzuki",
  "Hyundai",
  "Tata Motors",
  "Mahindra",
  "Honda",
  "Toyota",
  "Ford",
  "Chevrolet",
  "Volkswagen",
  "Skoda",
  "Renault",
  "Nissan",
  "Kia",
  "Ashok Leyland",
  "Bajaj",
  "Hero",
] as const;

export const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "LPG", "Electric", "Hybrid"] as const;

export const GUJARAT_DISTRICTS: Array<{
  district: string;
  cities: Array<{ city: string; areas: string[]; pinCode: string }>;
}> = [
  {
    district: "Ahmedabad",
    cities: [
      { city: "Ahmedabad", areas: ["Naroda GIDC", "SG Highway", "Sarkhej", "Bopal", "Odhav", "Vastral"], pinCode: "382330" },
      { city: "Sanand", areas: ["Sanand GIDC", "Bol Industrial"], pinCode: "382110" },
      { city: "Dholka", areas: ["Dholka Town", "Kheda Road"], pinCode: "382225" },
    ],
  },
  {
    district: "Surat",
    cities: [
      { city: "Surat", areas: ["Sachin GIDC", "Udhna", "Katargam", "Adajan", "Vesu", "Pandesara"], pinCode: "394230" },
      { city: "Bardoli", areas: ["Station Road", "Sardar Baug"], pinCode: "394601" },
      { city: "Hazira", areas: ["Hazira Industrial", "Mora"], pinCode: "394270" },
    ],
  },
  {
    district: "Vadodara",
    cities: [
      { city: "Vadodara", areas: ["Makarpura GIDC", "Alkapuri", "Waghodia", "Manjalpur", "Gorwa"], pinCode: "390010" },
      { city: "Karjan", areas: ["NH-48 Highway", "Karjan Bazar"], pinCode: "391240" },
      { city: "Padra", areas: ["Padra GIDC", "Station Area"], pinCode: "391440" },
    ],
  },
  {
    district: "Rajkot",
    cities: [
      { city: "Rajkot", areas: ["Shapar Veraval", "Kalawad Road", "Gondal Road", "Bhaktinagar"], pinCode: "360024" },
      { city: "Gondal", areas: ["Gondal GIDC", "College Chowk"], pinCode: "360311" },
      { city: "Jetpur", areas: ["Navagadh", "Dhoraji Road"], pinCode: "360370" },
    ],
  },
  {
    district: "Gandhinagar",
    cities: [
      { city: "Gandhinagar", areas: ["Sector 21", "Kudasan", "Adalaj", "Chhatral GIDC"], pinCode: "382021" },
      { city: "Kalol", areas: ["Kalol GIDC", "Pansar"], pinCode: "382721" },
    ],
  },
  {
    district: "Bhavnagar",
    cities: [
      { city: "Bhavnagar", areas: ["Chitra GIDC", "Alang Road", "Waghawadi Road"], pinCode: "364004" },
      { city: "Alang", areas: ["Alang Yard Zone", "Sosiya"], pinCode: "364081" },
    ],
  },
  {
    district: "Jamnagar",
    cities: [
      { city: "Jamnagar", areas: ["Dared GIDC", "Patel Colony", "Hapa Industrial"], pinCode: "361004" },
      { city: "Khambhalia", areas: ["Dwarka Highway"], pinCode: "361305" },
    ],
  },
  {
    district: "Anand",
    cities: [
      { city: "Anand", areas: ["Vallabh Vidyanagar", "Vitthal Udyognagar", "Gamdi"], pinCode: "388121" },
      { city: "Nadiad", areas: ["College Road", "Santram Mandir"], pinCode: "387001" },
    ],
  },
  {
    district: "Bharuch",
    cities: [
      { city: "Bharuch", areas: ["Ankleshwar GIDC", "Zadeshwar", "Dahej Road"], pinCode: "392001" },
      { city: "Ankleshwar", areas: ["GIDC Estate", "Piraman"], pinCode: "393002" },
    ],
  },
  {
    district: "Mehsana",
    cities: [
      { city: "Mehsana", areas: ["Modhera Road", "Dediyasan GIDC", "Radhanpur Road"], pinCode: "384002" },
      { city: "Visnagar", areas: ["Station Road", "Kansa"], pinCode: "384315" },
    ],
  },
  {
    district: "Valsad",
    cities: [
      { city: "Vapi", areas: ["Vapi GIDC", "Chala", "Gunjan"], pinCode: "396195" },
      { city: "Valsad", areas: ["Tithal Road", "Abrama"], pinCode: "396001" },
    ],
  },
  {
    district: "Kutch",
    cities: [
      { city: "Bhuj", areas: ["Madhapar", "Mirjapar Highway"], pinCode: "370001" },
      { city: "Gandhidham", areas: ["Kandla Road", "Adipur"], pinCode: "370201" },
    ],
  },
  {
    district: "Morbi",
    cities: [
      { city: "Morbi", areas: ["Sanala Road", "Trajpar", "8A National Highway"], pinCode: "363641" },
    ],
  },
  {
    district: "Junagadh",
    cities: [
      { city: "Junagadh", areas: ["Moti Baug", "Joshipura", "Zanzarda Road"], pinCode: "362001" },
    ],
  },
  {
    district: "Navsari",
    cities: [
      { city: "Navsari", areas: ["Lunsikui", "Grid Road", "Kabilpore"], pinCode: "396445" },
    ],
  },
];

export const ALL_GUJARAT_33_DISTRICTS = [
  "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch",
  "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka",
  "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch",
  "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal",
  "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar",
  "Tapi", "Vadodara", "Valsad",
] as const;

export const ROLE_DEFINITIONS = [
  {
    code: "SUPER_ADMIN",
    name: "Super Admin / Business Owner",
    description: "Complete access to entire platform, financials, audit logs, roles, settings, and exports.",
  },
  {
    code: "ADMIN",
    name: "Admin",
    description: "Manage customers, leads, vehicles, operations, campaigns, and permitted users.",
  },
  {
    code: "MANAGER",
    name: "Manager",
    description: "Assign leads, monitor team activity and follow-ups, review quotations, and track pickups.",
  },
  {
    code: "SALES_EXECUTIVE",
    name: "Sales Executive",
    description: "Work assigned leads, contact customers, schedule follow-ups, submit quotations for approval.",
  },
  {
    code: "MARKETING_EXECUTIVE",
    name: "Marketing Executive",
    description: "Analyze Meta Ads campaigns, ad sets, ads, lead sources, and marketing ROI reports.",
  },
  {
    code: "OPERATIONS_EXECUTIVE",
    name: "Operations Executive",
    description: "Manage vehicle inspections, pickups, collection status, documents, and processing inventory.",
  },
  {
    code: "ACCOUNTS_EXECUTIVE",
    name: "Accounts Executive",
    description: "Record vehicle purchase payments, expenses, revenues, payment statuses, and financial reports.",
  },
] as const;

export type RoleCode = (typeof ROLE_DEFINITIONS)[number]["code"];

export const NAV_MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/", submodules: ["Business Overview", "KPIs", "Activity"] },
  { key: "meta_ads", label: "Meta Ads", href: "/meta-ads", submodules: ["Overview", "Campaigns", "Ad Sets", "Ads", "Platform Comparison"] },
  { key: "leads", label: "Lead Management", href: "/leads", submodules: ["All Leads", "Add Lead", "Pipeline", "Lost Leads", "Duplicate Leads", "Recovery"] },
  { key: "followups", label: "Follow-ups", href: "/follow-ups", submodules: ["Today's Tasks", "Upcoming", "Overdue", "Completed"] },
  { key: "customers", label: "Customer Management", href: "/customers", submodules: ["Customers", "Customer Profiles", "Customer History"] },
  { key: "vehicles", label: "Vehicle Management", href: "/vehicles", submodules: ["Vehicles", "Inspections", "Quotations", "Pickup", "Documents", "Inventory"] },
  { key: "transactions", label: "Transactions", href: "/transactions", submodules: ["Purchases", "Payments", "Expenses", "Profitability"] },
  { key: "team", label: "Team Management", href: "/team", submodules: ["Employees", "Assignments", "Performance", "Targets"] },
  { key: "locations", label: "Location Analytics", href: "/locations", submodules: ["Districts", "Cities", "Location Performance"] },
  { key: "communication", label: "Communication", href: "/communication", submodules: ["Calls", "WhatsApp", "Emails", "Interaction History"] },
  { key: "reports", label: "Reports", href: "/reports", submodules: ["Marketing", "CRM", "Finance", "Operations", "Team"] },
  { key: "notifications", label: "Notifications", href: "/notifications", submodules: ["Alerts", "Reminders", "System Notifications"] },
  { key: "settings", label: "Settings", href: "/settings", submodules: ["Company", "Users", "Permissions", "Integrations", "Configuration"] },
] as const;

export const ROLE_NAV_ACCESS: Record<RoleCode, string[]> = {
  SUPER_ADMIN: NAV_MODULES.map((m) => m.key),
  ADMIN: [
    "dashboard", "meta_ads", "leads", "followups", "customers",
    "vehicles", "transactions", "team", "locations", "communication",
    "reports", "notifications", "settings",
  ],
  MANAGER: [
    "dashboard", "meta_ads", "leads", "followups", "customers",
    "vehicles", "team", "locations", "communication", "reports", "notifications",
  ],
  SALES_EXECUTIVE: [
    "dashboard", "leads", "followups", "customers", "vehicles", "communication", "notifications",
  ],
  MARKETING_EXECUTIVE: [
    "dashboard", "meta_ads", "leads", "locations", "reports", "notifications",
  ],
  OPERATIONS_EXECUTIVE: [
    "dashboard", "vehicles", "customers", "locations", "reports", "notifications",
  ],
  ACCOUNTS_EXECUTIVE: [
    "dashboard", "transactions", "vehicles", "customers", "reports", "notifications",
  ],
};
