"""GPS Trace Data API — serves GPS logs for the Digital Trace Map."""
import random
from fastapi import APIRouter
from app.services.ingestion.storage_service import load_all_synthetic
from app.utils.response_utils import success

router = APIRouter(prefix="/gps", tags=["gps"])


@router.get("/traces")
async def get_gps_traces(limit: int = 3):
    """Return GPS trace logs for map visualization."""
    gps_logs = load_all_synthetic("gps_logs")
    if not gps_logs:
        return success([], message="No GPS data available")
    
    # Pick a sample of logs
    sample = random.sample(gps_logs, min(limit, len(gps_logs)))
    return success(sample, message=f"{len(sample)} GPS trace logs retrieved")


@router.get("/traces/{device_id}")
async def get_device_trace(device_id: str):
    """Return GPS trace for a specific device."""
    gps_logs = load_all_synthetic("gps_logs")
    for log in gps_logs:
        if log.get("device_id") == device_id or log.get("id") == device_id:
            return success(log, message=f"GPS trace for {device_id}")
    # fallback: return first available
    if gps_logs:
        return success(gps_logs[0], message="GPS trace (fallback)")
    return success({}, message="No GPS data found")


@router.get("/summary")
async def get_gps_summary():
    """Aggregate GPS statistics across all traces."""
    gps_logs = load_all_synthetic("gps_logs")
    if not gps_logs:
        return success({
            "total_devices": 0, "total_pings": 0,
            "anomalies_detected": 0, "avg_coverage_km2": 0
        })
    
    total_pings = sum(log.get("total_pings", 0) for log in gps_logs)
    anomaly_count = sum(1 for log in gps_logs if log.get("anomalies_detected"))
    avg_coverage = sum(log.get("coverage_area_km2", 0) for log in gps_logs) / len(gps_logs)
    
    # Compute route stats from a representative trace
    sample = gps_logs[0]
    pings = sample.get("pings", [])
    speeds = [p.get("speed_kmh", 0) for p in pings]
    
    return success({
        "total_devices": len(gps_logs),
        "total_pings": total_pings,
        "anomalies_detected": anomaly_count,
        "avg_coverage_km2": round(avg_coverage, 2),
        "avg_speed_kmh": round(sum(speeds) / max(len(speeds), 1), 1),
        "max_speed_kmh": round(max(speeds) if speeds else 0, 1),
        "sample_device": sample.get("device_id"),
        "sample_owner": sample.get("owner"),
    }, message="GPS summary computed")
