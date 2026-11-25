import { GUJARAT_DISTRICTS, STAGE_INDEX } from "./constants";

export interface ScoringInput {
  respondedToFirstCall: boolean;
  vehicleDetailsProvided: boolean;
  district: string;
  rcAvailable: string;
  status: string;
  hasAcceptedOrNegotiatingQuote: boolean;
  hasScheduledOrDoneInspection: boolean;
}

export interface ScoringBreakdown {
  score: number;
  category: "High Intent" | "Medium Intent" | "Low Intent";
  factors: Array<{ label: string; points: number; met: boolean }>;
}

const SERVICEABLE_DISTRICTS = new Set(GUJARAT_DISTRICTS.map((d) => d.district.toLowerCase()));

/**
 * Computes transparent lead intent score (0-100) from PRD Section 17.1 factors.
 */
export function evaluateLeadIntent(input: ScoringInput): ScoringBreakdown {
  const stageIdx = STAGE_INDEX[input.status] ?? 0;
  const inServiceArea = SERVICEABLE_DISTRICTS.has((input.district || "").toLowerCase());
  const willingToProceed = stageIdx >= (STAGE_INDEX["Interested"] ?? 3) && input.status !== "Lost";

  const factors = [
    { label: "Customer responded to first call", points: 15, met: input.respondedToFirstCall },
    { label: "Vehicle details provided", points: 15, met: input.vehicleDetailsProvided },
    { label: "Vehicle location within Gujarat service area", points: 15, met: inServiceArea },
    { label: "Ownership / RC documentation available", points: 15, met: input.rcAvailable === "Yes" },
    { label: "Customer is willing to proceed", points: 15, met: willingToProceed },
    { label: "Quotation accepted or negotiating", points: 15, met: input.hasAcceptedOrNegotiatingQuote },
    { label: "Inspection agreed or completed", points: 10, met: input.hasScheduledOrDoneInspection },
  ];

  const score = factors.reduce((sum, f) => sum + (f.met ? f.points : 0), 0);
  const category =
    score >= 70 ? "High Intent" : score >= 40 ? "Medium Intent" : "Low Intent";

  return { score, category, factors };
}
