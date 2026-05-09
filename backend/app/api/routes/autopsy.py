"""
Autopsy Intelligence API.
"""
import random
import os
from fastapi import APIRouter, Body
from app.services.ai.autopsy_analyzer import autopsy_analyzer
from app.services.ingestion.storage_service import load_finding, save_finding, load_all_synthetic
from app.utils.response_utils import success, error
from app.core.config import settings
from app.utils.json_utils import load_json

router = APIRouter(prefix="/autopsy", tags=["autopsy"])

_DEMO_AUTOPSY_TEXT = """
POSTMORTEM EXAMINATION REPORT
Case No: AIV-2041-77 | Examiner: Dr. Priya Nair | Date: 22 May 2025

EXTERNAL EXAMINATION:
Male subject, approximately 28-32 years. Body temperature at scene: 22.1°C.
Ambient temperature: 24.8°C. Rigor mortis: full, present in all muscle groups.
Livor mortis: fixed, present on anterior surface — suggests body repositioned.

INJURIES:
1. Cranial region: 8cm laceration with underlying fracture. Consistent with blunt force trauma.
2. Thoracic: Multiple rib fractures (4th-6th bilateral). Internal hemorrhage confirmed.
3. Neck: Compression marks. Petechial hemorrhage in conjunctiva.

TOXICOLOGY (Preliminary):
Blood ethanol: 0.09 g/dL. Benzodiazepine screen: POSITIVE — consistent with Lorazepam.
Levels above therapeutic threshold. Carbon monoxide: negative.

CAUSE OF DEATH: Blunt force trauma to cranial region with compounding internal hemorrhage.
MANNER: Homicide.

ESTIMATED TIME OF DEATH: 02:00-04:00 AM based on temperature gradient and rigor state.
"""


@router.post("/analyze")
async def analyze_autopsy(
    report_text: str = Body(..., embed=True),
):
    if len(report_text.strip()) < 20:
        return error("Report text too short", code=400)
    findings = await autopsy_analyzer.analyze(report_text)
    save_finding(findings.model_dump(), "latest", "autopsy")
    return success(findings.model_dump(), message="Autopsy analysis complete")


@router.post("/analyze/{file_id}")
async def analyze_autopsy_file(file_id: str):
    extraction = load_finding(file_id, "extraction")
    if not extraction:
        return error(f"File {file_id} not found", code=404)
    text = extraction.get("text_preview", "") or _DEMO_AUTOPSY_TEXT
    findings = await autopsy_analyzer.analyze(text)
    save_finding(findings.model_dump(), file_id, "autopsy")
    return success(findings.model_dump(), message="Autopsy analysis complete")


@router.get("/demo")
async def get_demo_autopsy():
    reports = load_all_synthetic("autopsy_reports")
    text = random.choice(reports).get("report_text", _DEMO_AUTOPSY_TEXT) if reports else _DEMO_AUTOPSY_TEXT
    findings = await autopsy_analyzer.analyze(text)
    return success(findings.model_dump(), message="Demo autopsy analysis")


@router.get("/history")
async def get_autopsy_history():
    results = []
    if os.path.isdir(settings.FINDINGS_DIR):
        for fname in os.listdir(settings.FINDINGS_DIR):
            if fname.endswith("_autopsy.json"):
                data = load_json(os.path.join(settings.FINDINGS_DIR, fname))
                if data:
                    results.append(data)
    return success(results, message=f"{len(results)} analyses found")
