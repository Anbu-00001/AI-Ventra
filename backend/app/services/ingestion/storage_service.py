"""
Storage service — saves and loads analysis outputs as JSON.
"""
import os
from app.core.config import settings
from app.utils.json_utils import save_json, load_json
from app.utils.file_utils import ensure_dir


def save_finding(finding: dict, file_id: str, category: str = "finding") -> str:
    ensure_dir(settings.FINDINGS_DIR)
    path = os.path.join(settings.FINDINGS_DIR, f"{file_id}_{category}.json")
    save_json(finding, path)
    return path


def save_timeline(timeline: dict, timeline_id: str) -> str:
    ensure_dir(settings.TIMELINES_DIR)
    path = os.path.join(settings.TIMELINES_DIR, f"{timeline_id}.json")
    save_json(timeline, path)
    return path


def save_report(report: dict, report_id: str) -> str:
    ensure_dir(settings.REPORTS_DIR)
    path = os.path.join(settings.REPORTS_DIR, f"{report_id}.json")
    save_json(report, path)
    return path


def save_correlation(graph: dict, graph_id: str) -> str:
    ensure_dir(settings.CORRELATIONS_DIR)
    path = os.path.join(settings.CORRELATIONS_DIR, f"{graph_id}.json")
    save_json(graph, path)
    return path


def load_finding(file_id: str, category: str = "finding") -> dict | None:
    path = os.path.join(settings.FINDINGS_DIR, f"{file_id}_{category}.json")
    return load_json(path)


def load_all_synthetic(subdir: str) -> list[dict]:
    base = os.path.join(settings.SYNTHETIC_DIR, subdir)
    if not os.path.isdir(base):
        return []
    results = []
    for fname in sorted(os.listdir(base)):
        if fname.endswith(".json"):
            data = load_json(os.path.join(base, fname))
            if data:
                results.append(data)
    return results
