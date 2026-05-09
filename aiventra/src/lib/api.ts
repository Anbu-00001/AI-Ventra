/**
 * AIVENTRA Backend API Client
 * Connects Next.js frontend to the FastAPI backend at localhost:8000
 * Uses Next.js rewrites proxy so requests go to /api/* (same origin)
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

// ─── Health ───────────────────────────────────────────────────────────────────
export const checkHealth = () => apiFetch<HealthResponse>("/health");

// ─── Upload ───────────────────────────────────────────────────────────────────
export async function uploadEvidence(file: File, caseId = "AIV-2041-77") {
  const form = new FormData();
  form.append("file", file);
  form.append("case_id", caseId);
  const res = await fetch(`${BASE_URL}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export const getUploadStatus = (fileId: string) =>
  apiFetch<UploadStatusResponse>(`/upload/status/${fileId}`);

export const listUploadedFiles = () =>
  apiFetch<ApiResponse<Array<{ file_id: string; filename: string; file_type: string; chunk_count: number; text_preview: string; status: string }>>>("/upload/list");

export const wipeAllData = () =>
  apiFetch<ApiResponse<null>>("/upload/wipe", { method: "POST" });


// ─── Autopsy ──────────────────────────────────────────────────────────────────
export const getDemoAutopsy = () => apiFetch<ApiResponse<AutopsyFindings>>("/autopsy/demo");

export const analyzeAutopsy = (reportText: string) =>
  apiFetch<ApiResponse<AutopsyFindings>>("/autopsy/analyze", {
    method: "POST",
    body: JSON.stringify({ report_text: reportText }),
  });

// ─── Timeline ─────────────────────────────────────────────────────────────────
export const getDemoTimeline = () => apiFetch<ApiResponse<ReconstructedTimeline>>("/timeline/demo");

export const reconstructTimeline = (evidenceContext: Record<string, unknown>) =>
  apiFetch<ApiResponse<ReconstructedTimeline>>("/timeline/reconstruct", {
    method: "POST",
    body: JSON.stringify(evidenceContext),
  });

// ─── Correlation ──────────────────────────────────────────────────────────────
export const getDemoCorrelation = () =>
  apiFetch<ApiResponse<CorrelationGraph>>("/correlation/demo");

export const getEvidenceCorrelation = () =>
  apiFetch<ApiResponse<CorrelationGraph>>("/correlation/from-evidence");

export const buildCorrelation = (entitiesData: Record<string, unknown>) =>
  apiFetch<ApiResponse<CorrelationGraph>>("/correlation/build", {
    method: "POST",
    body: JSON.stringify(entitiesData),
  });

// ─── Anomaly ──────────────────────────────────────────────────────────────────
export const getDemoAnomalies = () =>
  apiFetch<ApiResponse<AnomalyReport>>("/anomaly/demo");

export const getAnomalyFromEvidence = () =>
  apiFetch<ApiResponse<AnomalyReport>>("/anomaly/from-evidence");

export const detectAnomalies = (evidenceData: Record<string, unknown>) =>
  apiFetch<ApiResponse<AnomalyReport>>("/anomaly/detect", {
    method: "POST",
    body: JSON.stringify(evidenceData),
  });

// ─── Reports ──────────────────────────────────────────────────────────────────
export const getDemoReport = () =>
  apiFetch<ApiResponse<TriageReport>>("/reports/demo");

export const generateReport = (caseId = "AIV-2041-77") =>
  apiFetch<ApiResponse<TriageReport>>("/report/generate", {
    method: "POST",
    body: JSON.stringify({ case_id: caseId }),
  });

export const getReportsList = () =>
  apiFetch<ApiResponse<Array<{ report_id: string; case_id: string; threat_level: string; risk_score: number }>>>("/reports/list");

export const getRiskScore = (params: {
  autopsy_confidence?: number;
  anomaly_score?: number;
  timeline_confidence?: number;
  correlation_confidence?: number;
  evidence_count?: number;
}) => {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return apiFetch<ApiResponse<RiskScore>>(`/reports/risk-score?${query}`);
};

// ─── RAG ──────────────────────────────────────────────────────────────────────
export const queryRAG = (question: string, topK = 5) =>
  apiFetch<ApiResponse<RAGResult>>("/rag/query", {
    method: "POST",
    body: JSON.stringify({ question, top_k: topK }),
  });

export const explainConclusion = (conclusion: string) =>
  apiFetch<ApiResponse<ExplainabilityResult>>("/rag/explain", {
    method: "POST",
    body: JSON.stringify({ conclusion }),
  });

export const getRagStats = () => apiFetch<ApiResponse<RAGStats>>("/rag/stats");

export const indexSyntheticData = () =>
  apiFetch<ApiResponse<{ chunks_indexed: number; total_vectors: number }>>("/rag/index-synthetic", {
    method: "POST",
  });

// ─── Case-specific endpoints ─────────────────────────────────────────────────
export const getTimelineFromCase = (caseId: string) =>
  apiFetch<ApiResponse<ReconstructedTimeline>>(`/timeline/from-case/${caseId}`, {
    method: "POST",
  });

export const getAnomalyFromCase = (caseId: string) =>
  apiFetch<ApiResponse<AnomalyReport>>(`/anomaly/from-case/${caseId}`, {
    method: "POST",
  });

export const getCorrelationFromCase = (caseId: string) =>
  apiFetch<ApiResponse<CorrelationGraph>>(`/correlation/from-case/${caseId}`, {
    method: "POST",
  });

// ─── GPS Trace Data ───────────────────────────────────────────────────────────
export interface GPSPing {
  timestamp: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  accuracy_m: number;
  tower_id: string;
}

export interface GPSLog {
  id: string;
  device_id: string;
  case_id: string;
  owner: string;
  date: string;
  pings: GPSPing[];
  anomalies_detected: boolean;
  total_pings: number;
  coverage_area_km2: number;
}

export interface GPSSummary {
  total_devices: number;
  total_pings: number;
  anomalies_detected: number;
  avg_coverage_km2: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  sample_device: string;
  sample_owner: string;
}

export const getGPSTraces = (limit = 3) =>
  apiFetch<ApiResponse<GPSLog[]>>(`/gps/traces?limit=${limit}`);

export const getDeviceTrace = (deviceId: string) =>
  apiFetch<ApiResponse<GPSLog>>(`/gps/traces/${deviceId}`);

export const getGPSSummary = () =>
  apiFetch<ApiResponse<GPSSummary>>("/gps/summary");

// ─── Video Analysis ───────────────────────────────────────────────────────────
export async function uploadVideoForAnalysis(
  file: File,
  caseId = "AIV-2041-77"
): Promise<ApiResponse<VideoAnalysisReport>> {
  const form = new FormData();
  form.append("file", file);
  form.append("case_id", caseId);
  const res = await fetch(`${BASE_URL}/upload-video`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function createVideoAnalysisWS(): WebSocket {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? `ws://localhost:8000`;
  return new WebSocket(`${wsUrl}/api/live-analysis`);
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
export function createAnalysisWebSocket(caseId: string): WebSocket {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? `ws://localhost:8000`;
  return new WebSocket(`${wsUrl}/ws/${caseId}`);
}

// ─── SSE Progress Stream ──────────────────────────────────────────────────────
export function createProgressStream(
  fileId: string,
  onStage: (stage: string, progress: number, detail: string) => void,
  onComplete: () => void
): EventSource {
  const source = new EventSource(`${BASE_URL}/upload/stream/${fileId}`);
  source.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === "stage_update") {
      onStage(data.stage_label, data.progress, data.detail);
    } else if (data.type === "complete") {
      onComplete();
      source.close();
    }
  };
  return source;
}

// ─── Type Definitions ─────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  status: string;
  timestamp: string;
  message: string;
  data: T;
}

export interface HealthResponse {
  status: string;
  llm: string;
  rag: string;
  components: {
    api: string;
    featherless: string;
    rag: string;
    vector_store_size: number;
  };
  primary_model: string;
  backup_model: string;
  provider: string;
  message: string;
}

export interface AutopsyFindings {
  case_id: string;
  report_id: string;
  cause_of_death: string;
  manner_of_death: string;
  tod_estimate: string;
  tod_window_hours: number;
  injuries: Array<{ region: string; description: string; severity: string; confidence: number }>;
  toxicity_flags: Array<{ substance: string; detected: boolean; confidence: number; note: string }>;
  environmental_conflicts: string[];
  rigor_mortis_stage: string;
  livor_mortis_pattern: string;
  postmortem_interval_hours: number;
  confidence: number;
  reasoning: string;
  contributing_factors: string[];
  generated_at: string;
}

export interface TimelineEvent {
  event_id: string;
  timestamp: string;
  event_type: string;
  title: string;
  description: string;
  location?: string;
  actors: string[];
  confidence: number;
  source: string;
  is_anomaly: boolean;
  severity?: string;
}

export interface ReconstructedTimeline {
  timeline_id: string;
  case_id: string;
  events: TimelineEvent[];
  total_events: number;
  anomaly_count: number;
  confidence_score: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  narrative_summary: string;
  key_insights: string[];
}

export interface CorrelationNode {
  id: string;
  label: string;
  meta: string;
  node_type: string;
  confidence: number;
}

export interface CorrelationEdge {
  source: string;
  target: string;
  relationship: string;
  strength: string;
  confidence: number;
  explanation: string;
}

export interface CorrelationGraph {
  graph_id: string;
  case_id: string;
  nodes: CorrelationNode[];
  edges: CorrelationEdge[];
  total_nodes: number;
  total_edges: number;
  ai_insight: string;
  insight_confidence: number;
}

export interface AnomalyFinding {
  anomaly_id: string;
  anomaly_type: string;
  description: string;
  severity: string;
  threat_score: number;
  detected_at: string;
  confidence: number;
  contributing_factors: Array<{ factor: string; weight: number; explanation: string }>;
  recommended_action: string;
}

export interface AnomalyReport {
  case_id: string;
  overall_threat_level: string;
  overall_threat_score: number;
  anomalies: AnomalyFinding[];
  behavioral_profile: {
    deviation_score: number;
    pattern_shift: string;
    baseline_comparison: string;
  };
  escalation_probability: number;
}

export interface TriageReport {
  report_id: string;
  case_id: string;
  risk_score: number;
  threat_level: string;
  verdict: string;
  reasoning: string;
  supporting_evidence: Array<{ evidence_type: string; description: string; weight: number }>;
  key_findings: string[];
  recommended_actions: string[];
  confidence_score: number;
  generated_at: string;
}

export interface RiskScore {
  risk_score: number;
  threat_level: string;
  breakdown: Record<string, number>;
}

export interface RAGResult {
  answer: string;
  confidence: number;
  evidence_basis: string[];
  reasoning: string;
  caveats: string[];
  follow_up_queries: string[];
  retrieved_chunks: string[];
  chunk_count: number;
}

export interface ExplainabilityResult {
  conclusion: string;
  explanation: string;
  key_evidence_points: Array<{ point: string; chunk_reference: number; weight: number }>;
  confidence_breakdown: {
    data_quality: number;
    evidence_completeness: number;
    logical_consistency: number;
    overall: number;
  };
}

export interface RAGStats {
  total_vectors: number;
  dimension: number;
  status: string;
}

export interface UploadStatusResponse {
  status: string;
  data: { file_id: string; status: string };
}

// ─── Video Analysis Types ─────────────────────────────────────────────────────
export interface BoundingBox { x1: number; y1: number; x2: number; y2: number; }

export interface VideoDetection {
  frame_index: number;
  timestamp: string;
  label: string;
  confidence: number;
  bbox: BoundingBox;
  track_id: string | null;
  centroid: [number, number] | null;
}

export interface ForensicEvent {
  id: string;
  timestamp: string;
  event: string;
  confidence: number;
  severity: string;
  category: string;
  evidence: string[];
  frame_index: number | null;
}

export interface MovementAnomaly {
  timestamp: string;
  type: string;
  confidence: number;
  severity: string;
  description: string;
  metrics: Record<string, number>;
}

export interface EntitySummary {
  label: string;
  count: number;
  max_confidence: number;
  first_seen: string;
  last_seen: string;
}

export interface ReasoningOutput {
  threat_level: string;
  reasoning: string[];
  narration: string[];
  rag_context: Record<string, unknown>[];
  ollama_used: boolean;
}

export interface VideoAnalysisReport {
  analysis_id: string;
  case_id: string;
  source_video: string;
  processed_video_url: string | null;
  duration_seconds: number;
  fps: number;
  frame_count: number;
  processed_frames: number;
  threat_score: number;
  threat_level: string;
  detected_entities: EntitySummary[];
  event_timeline: ForensicEvent[];
  movement_anomalies: MovementAnomaly[];
  reasoning_engine: ReasoningOutput;
  confidence_waveform: number[];
  snapshots: string[];
  meta: Record<string, unknown>;
}
