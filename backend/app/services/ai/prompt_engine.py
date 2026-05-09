"""
Centralised prompt library.
Every LLM call pulls its system/user prompt from here — no prompts in business logic.
All prompts explicitly demand JSON output and use forensic intelligence tone.
"""


class PromptEngine:

    # ────────────────────────────────────────────────────────────────────
    # System prompts (role definitions)
    # ────────────────────────────────────────────────────────────────────

    FORENSIC_SYSTEM = """You are AIVENTRA, an elite AI forensic intelligence engine deployed by
investigative agencies. You analyze forensic evidence with surgical precision.

CRITICAL RULES:
1. ALWAYS output valid JSON — no prose, no markdown, no explanation outside the JSON.
2. Use forensic/intelligence terminology.
3. Confidence values are 0–100 floats.
4. Be specific, actionable, and defensible.
5. Never fabricate witness testimony or names unless asked for synthetic data."""

    SYNTHESIS_SYSTEM = """You are AIVENTRA's synthesis layer. Your role is to aggregate findings
from multiple evidence streams into coherent intelligence reports.
Output ONLY valid JSON. Use clinical, precise language."""

    # ────────────────────────────────────────────────────────────────────
    # Autopsy analysis
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def autopsy_analysis(report_text: str) -> str:
        return f"""FORENSIC AUTOPSY ANALYSIS REQUEST

Analyze the following autopsy report and extract structured forensic intelligence.

REPORT TEXT:
{report_text}

Return ONLY this JSON structure (all fields required):
{{
  "cause_of_death": "<specific medical cause>",
  "manner_of_death": "<homicide|suicide|accident|natural|undetermined>",
  "tod_estimate": "<human-readable time range e.g. 02:00 AM – 04:00 AM>",
  "tod_window_hours": <float — width of the TOD window>,
  "injuries": [
    {{"region": "<body region>", "description": "<clinical detail>", "severity": "<SEVERE|MODERATE|MILD>", "confidence": <0-100>}}
  ],
  "toxicity_flags": [
    {{"substance": "<name>", "detected": <true|false>, "confidence": <0-100>, "note": "<clinical note>"}}
  ],
  "environmental_conflicts": ["<conflict description>"],
  "rigor_mortis_stage": "<stage description>",
  "livor_mortis_pattern": "<pattern description>",
  "postmortem_interval_hours": <float>,
  "confidence": <overall confidence 0-100>,
  "reasoning": "<chain-of-reasoning paragraph>",
  "contributing_factors": ["<factor 1>", "<factor 2>"]
}}"""

    @staticmethod
    def tod_estimation(indicators: dict) -> str:
        return f"""TIME OF DEATH ESTIMATION

Postmortem indicators provided:
{indicators}

Using Henssge nomogram principles and environmental correction factors,
estimate the time of death window.

Return ONLY this JSON:
{{
  "earliest_tod": "<ISO timestamp>",
  "latest_tod": "<ISO timestamp>",
  "most_probable_tod": "<ISO timestamp>",
  "window_hours": <float>,
  "method": "Henssge nomogram with environmental correction",
  "corrections_applied": ["<correction 1>"],
  "confidence": <0-100>,
  "limiting_factors": ["<factor>"]
}}"""

    # ────────────────────────────────────────────────────────────────────
    # Evidence classification
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def classify_evidence(content_preview: str, filename: str, file_type: str) -> str:
        return f"""EVIDENCE CLASSIFICATION

File: {filename} (type: {file_type})
Content preview:
{content_preview[:800]}

Classify this evidence file into our forensic taxonomy.

Return ONLY this JSON:
{{
  "primary_category": "<physical_evidence|digital_evidence|behavioral_evidence|environmental_data|autopsy_report|gps_log|cctv_log|call_log|financial_record|forensic_image>",
  "sub_category": "<specific sub-type>",
  "confidence": <0-100>,
  "tags": ["<tag1>", "<tag2>"],
  "priority": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "forensic_value": "<brief assessment>",
  "entities_present": ["<entity type list>"]
}}"""

    # ────────────────────────────────────────────────────────────────────
    # Entity extraction
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def extract_entities(text: str) -> str:
        return f"""FORENSIC ENTITY EXTRACTION

Extract all named entities, timestamps, and forensic indicators from the following text.

TEXT:
{text[:2000]}

Return ONLY this JSON:
{{
  "persons": [{{"name": "<name>", "role": "<suspect|victim|witness|unknown>", "confidence": <0-100>}}],
  "locations": [{{"name": "<location>", "type": "<address|landmark|coordinates>", "confidence": <0-100>}}],
  "devices": [{{"id": "<device id or description>", "type": "<phone|laptop|camera|vehicle>", "confidence": <0-100>}}],
  "timestamps": [{{"raw": "<original text>", "normalized": "<ISO 8601>", "event_type": "<type>", "confidence": <0-100>}}],
  "organizations": [{{"name": "<name>", "role": "<role>", "confidence": <0-100>}}],
  "physical_evidence": [{{"description": "<item>", "forensic_significance": "<significance>", "confidence": <0-100>}}]
}}"""

    # ────────────────────────────────────────────────────────────────────
    # Timeline reconstruction
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def reconstruct_timeline(evidence_context: str) -> str:
        return f"""FORENSIC TIMELINE RECONSTRUCTION

Reconstruct a chronological incident timeline from the following correlated evidence.

EVIDENCE CONTEXT:
{evidence_context}

Create a precise, temporally ordered sequence of events.

Return ONLY this JSON array:
{{
  "events": [
    {{
      "timestamp": "<ISO 8601 or HH:MM AM/PM>",
      "event_type": "<PHONE_ACTIVITY|CCTV_DETECTION|GPS_PING|CALL|SIGNAL_LOSS|VEHICLE_MOVEMENT|ANOMALY|SUSPECT_ACTION>",
      "title": "<concise event title>",
      "description": "<detailed forensic description>",
      "location": "<location or null>",
      "actors": ["<actor id/name>"],
      "confidence": <0-100>,
      "source": "<evidence source>",
      "is_anomaly": <true|false>,
      "severity": "<LOW|MODERATE|HIGH|CRITICAL or null>"
    }}
  ],
  "narrative_summary": "<2-3 sentence reconstruction narrative>",
  "key_insights": ["<insight 1>", "<insight 2>"],
  "confidence_score": <overall 0-100>
}}"""

    # ────────────────────────────────────────────────────────────────────
    # Anomaly detection
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def detect_anomalies(behavioral_data: str) -> str:
        return f"""BEHAVIORAL ANOMALY DETECTION

Analyze the following evidence data for behavioral anomalies, inconsistencies,
and suspicious patterns.

DATA:
{behavioral_data}

Return ONLY this JSON:
{{
  "overall_threat_level": "<CRITICAL|HIGH|ELEVATED|MODERATE|LOW>",
  "overall_threat_score": <0-100>,
  "anomalies": [
    {{
      "anomaly_type": "<behavioral_deviation|gps_inconsistency|metadata_gap|communication_silence|temporal_anomaly|financial_irregularity|route_deviation>",
      "description": "<precise anomaly description>",
      "severity": "<CRITICAL|HIGH|MODERATE|LOW>",
      "threat_score": <0-100>,
      "detected_at": "<timestamp>",
      "evidence_source": "<source file/log>",
      "confidence": <0-100>,
      "contributing_factors": [
        {{"factor": "<factor name>", "weight": <0-100>, "explanation": "<why this matters forensically>"}}
      ],
      "recommended_action": "<investigative action>"
    }}
  ],
  "behavioral_profile": {{
    "deviation_score": <0-100>,
    "pattern_shift": "<LOW|MEDIUM|HIGH>",
    "baseline_comparison": "<summary>"
  }},
  "escalation_probability": <0-100>
}}"""

    # ────────────────────────────────────────────────────────────────────
    # Evidence correlation
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def correlate_evidence(entities_context: str) -> str:
        return f"""EVIDENCE CORRELATION ANALYSIS

Build a correlation graph from the following entity data.
Identify connections, relationships, and suspicious patterns.

ENTITY DATA:
{entities_context}

Return ONLY this JSON:
{{
  "nodes": [
    {{"id": "<unique_id>", "label": "<display_label>", "meta": "<sub-label>", "node_type": "<suspect|device|location|timestamp|document>", "confidence": <0-100>}}
  ],
  "edges": [
    {{"source": "<node_id>", "target": "<node_id>", "relationship": "<COMMUNICATED_WITH|LOCATED_AT|OWNS_DEVICE|PRESENT_AT|CONNECTED_TO|CORRELATES_WITH|CONTRADICTS|SUPPORTS|PRECEDES|FOLLOWS>", "strength": "<very-high|high|medium|low|very-low>", "confidence": <0-100>, "explanation": "<why connected>"}}
  ],
  "ai_insight": "<paragraph — key pattern the AI detected>",
  "insight_confidence": <0-100>,
  "high_confidence_paths": [["<node_id_1>", "<node_id_2>"]]
}}"""

    # ────────────────────────────────────────────────────────────────────
    # Final triage verdict
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def generate_verdict(case_summary: str) -> str:
        return f"""FINAL FORENSIC TRIAGE VERDICT

Synthesize all case intelligence and generate a final risk assessment and verdict.

CASE SUMMARY:
{case_summary}

Return ONLY this JSON:
{{
  "risk_score": <0-100>,
  "threat_level": "<CRITICAL|HIGH|ELEVATED|MODERATE|LOW>",
  "verdict": "<single definitive sentence — the AI's conclusion>",
  "reasoning": "<3-4 paragraph forensic reasoning>",
  "supporting_evidence": [
    {{"evidence_type": "<type>", "description": "<detail>", "weight": <0-100>}}
  ],
  "key_findings": ["<finding 1>", "<finding 2>", "<finding 3>"],
  "recommended_actions": [
    "<action 1>",
    "<action 2>"
  ],
  "confidence_score": <0-100>
}}"""

    # ────────────────────────────────────────────────────────────────────
    # RAG explanation
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def rag_explanation(query: str, retrieved_chunks: list[str]) -> str:
        context = "\n\n---\n\n".join(retrieved_chunks)
        return f"""FORENSIC INTELLIGENCE QUERY

Query: {query}

Retrieved Evidence Chunks:
{context}

Answer the query using ONLY the provided evidence chunks.
Explain your reasoning with forensic precision.

Return ONLY this JSON:
{{
  "answer": "<direct answer to the query>",
  "confidence": <0-100>,
  "evidence_basis": ["<which chunks support this>"],
  "reasoning": "<step-by-step forensic reasoning>",
  "caveats": ["<limitation or uncertainty>"],
  "follow_up_queries": ["<suggested next query>"]
}}"""

    @staticmethod
    def explainability(conclusion: str, evidence_chunks: list[str]) -> str:
        context = "\n".join(f"[{i+1}] {c[:300]}" for i, c in enumerate(evidence_chunks))
        return f"""AI EXPLAINABILITY REPORT

Conclusion reached: {conclusion}

Supporting evidence retrieved:
{context}

Explain in plain forensic language WHY the AI reached this conclusion.

Return ONLY this JSON:
{{
  "conclusion": "{conclusion}",
  "explanation": "<plain language explanation>",
  "key_evidence_points": [
    {{"point": "<evidence point>", "chunk_reference": <1-based index>, "weight": <0-100>}}
  ],
  "confidence_breakdown": {{
    "data_quality": <0-100>,
    "evidence_completeness": <0-100>,
    "logical_consistency": <0-100>,
    "overall": <0-100>
  }},
  "alternative_hypotheses": ["<hypothesis 1>"],
  "limitations": ["<limitation>"]
}}"""


prompt_engine = PromptEngine()
