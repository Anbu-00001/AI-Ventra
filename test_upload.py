import httpx
import os
import time

FILES_DIR = "/home/anbu/26_class/AIVentra_org/test_data"
BASE_URL = "http://localhost:8000/api"

def upload_all():
    print("Wiping all existing data...")
    res = httpx.post(f"{BASE_URL}/upload/wipe", timeout=120)
    print(res.json())

    for fname in os.listdir(FILES_DIR):
        fpath = os.path.join(FILES_DIR, fname)
        if not os.path.isfile(fpath): continue
        print(f"Uploading {fname}...")
        with open(fpath, "rb") as f:
            files = {"file": (fname, f, "application/octet-stream")}
            data = {"case_id": "AIV-2041-77"}
            r = httpx.post(f"{BASE_URL}/upload", files=files, data=data, timeout=120)
            print("  ", r.status_code, r.json().get("status"))

    print("Waiting 5s for background processing...")
    time.sleep(5)

def check_endpoints():
    endpoints = [
        "/autopsy/from-evidence",
        "/anomaly/from-evidence",
        "/correlation/from-evidence",
        "/timeline/from-case/AIV-2041-77"
    ]
    
    for ep in endpoints:
        print(f"Testing {ep}...")
        try:
            # Short timeout so it doesn't block forever
            # Actually use a 120s timeout since Ollama might be running
            if "timeline" in ep:
                res = httpx.post(f"{BASE_URL}{ep}", timeout=120)
            else:
                res = httpx.get(f"{BASE_URL}{ep}", timeout=120)
                
            data = res.json().get("data", {})
            if "autopsy" in ep:
                print(f"  Autopsy: {data.get('cause_of_death')}, Confidence: {data.get('confidence')}")
            elif "anomaly" in ep:
                print(f"  Anomaly: {data.get('overall_threat_level')} Score: {data.get('overall_threat_score')} Count: {len(data.get('anomalies', []))}")
            elif "correlation" in ep:
                print(f"  Correlation: {data.get('total_nodes')} nodes, {data.get('total_edges')} edges")
            elif "timeline" in ep:
                print(f"  Timeline: {data.get('total_events')} events, {data.get('anomaly_count')} anomalies")
                
        except Exception as e:
            print(f"  Failed: {e}")

if __name__ == "__main__":
    upload_all()
    check_endpoints()
