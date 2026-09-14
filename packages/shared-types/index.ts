export type UserRole = "farmer" | "officer" | "researcher" | "admin";

export interface UserOut {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  language_pref: string;
}

export interface FarmOut {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  land_size_ha: number | null;
  region: string | null;
  created_at: string;
}

export type DiagnosisType = "plant_id" | "disease" | "pest";
export type Severity = "low" | "moderate" | "high" | "critical";

export interface DiagnosisOut {
  id: string;
  diagnosis_type: DiagnosisType;
  result_label: string;
  confidence_score: number;
  severity: Severity | null;
  image_url: string;
  heatmap_url: string | null;
  needs_expert_review: boolean;
  model_version: string;
  created_at: string;
  causes?: string | null;
  organic_treatment?: string | null;
  chemical_treatment?: string | null;
  prevention_tips?: string | null;
  retry_guidance?: string | null;
}

export interface RecommendationOut {
  id: string;
  type: "irrigation" | "fertilizer" | "harvest" | "disease_risk" | "general";
  content: string;
  source: "rule_engine" | "llm" | "expert";
  valid_until: string | null;
  created_at: string;
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  follow_up_questions: string[];
}
