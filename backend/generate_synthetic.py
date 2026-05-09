"""
Synthetic forensic dataset generator.
Run: python generate_synthetic.py
Generates 50 autopsy reports, 100 GPS logs, 100 CCTV logs, 50 call logs,
30 environmental reports, 25 suspect profiles, and case files into
app/data/synthetic/
"""
import json
import random
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.absolute()
SYNTHETIC_DIR = SCRIPT_DIR / "app" / "data" / "synthetic"

NAMES = [
    "Rahul Sharma", "Priya Nair", "Arjun Mehta", "Kavya Reddy", "Vikram Singh",
    "Deepa Iyer", "Kiran Patel", "Rohan Joshi", "Ananya Das", "Suresh Kumar",
    "Meena Pillai", "Aditya Gupta", "Sneha Rao", "Rajesh Choudhary", "Pooja Verma",
    "Amit Shah", "Divya Krishnan", "Nikhil Bose", "Swathi Menon", "Sanjay Chopra",
]

INJURIES = [
    {"region": "Cranial", "description": "Blunt force trauma with {severity} fracture", "severity": "SEVERE"},
    {"region": "Thoracic", "description": "Multiple rib fractures with internal hemorrhage", "severity": "SEVERE"},
    {"region": "Neck", "description": "Compression marks consistent with ligature strangulation", "severity": "SEVERE"},
    {"region": "Abdominal", "description": "Blunt force trauma with splenic laceration", "severity": "MODERATE"},
    {"region": "Upper Limb", "description": "Defensive bruising on forearms", "severity": "MODERATE"},
    {"region": "Lower Limb", "description": "Multiple contusions consistent with assault", "severity": "MILD"},
    {"region": "Facial", "description": "Periorbital ecchymosis bilateral", "severity": "MODERATE"},
    {"region": "Dorsal", "description": "Pattern bruising consistent with impact", "severity": "MODERATE"},
]

SUBSTANCES = ["Benzodiazepines", "Ethanol", "Opiates", "Ketamine", "GHB", "Chloroform", "Carbon Monoxide"]
LOCATIONS_BLR = [
    "MG Road, Bangalore", "Service Road, Whitefield", "Phoenix Mall Area",
    "Outer Ring Road, Marathahalli", "Hebbal Lake, Bangalore", "Koramangala 5th Block",
    "Electronic City Phase 2", "Bellandur Lake Road", "Doddanekundi Industrial Area",
    "Sarjapur Road, Bangalore",
]
CAMERA_IDS = [f"CAM_{i:03d}" for i in range(1, 30)]
TOWER_IDS = [f"BLR_{random.randint(1000,9999)}" for _ in range(20)]


def make_autopsy(i: int) -> dict:
    subject = random.choice(NAMES)
    age = random.randint(18, 65)
    tod_hour = random.randint(0, 5)
    tod_start = f"{tod_hour:02d}:{random.choice(['00','15','30','45'])} {'AM' if tod_hour < 12 else 'PM'}"
    tod_window = random.uniform(1.5, 4.0)
    body_temp = round(random.uniform(18.0, 28.0), 1)
    ambient_temp = round(random.uniform(20.0, 32.0), 1)
    pmi = round(random.uniform(4.0, 18.0), 1)
    injuries = random.sample(INJURIES, random.randint(2, 5))
    substances = random.sample(SUBSTANCES, random.randint(0, 3))

    return {
        "id": f"AR-{i:04d}",
        "case_id": f"AIV-{random.randint(2000,2099)}-{random.randint(10,99)}",
        "examiner": f"Dr. {random.choice(NAMES)}",
        "examination_date": (datetime(2025, 5, 1) + timedelta(days=random.randint(0, 120))).strftime("%d %B %Y"),
        "subject_name": subject,
        "subject_age": age,
        "subject_gender": random.choice(["Male", "Female"]),
        "body_temperature_celsius": body_temp,
        "ambient_temperature_celsius": ambient_temp,
        "rigor_mortis": random.choice(["Full rigor", "Partial rigor — onset", "Post-rigor — decomposition stage 1"]),
        "livor_mortis": random.choice([
            "Fixed anterior — body repositioned post-mortem",
            "Fixed posterior — no repositioning",
            "Unfixed — TOD within 4 hours",
        ]),
        "postmortem_interval_hours": pmi,
        "injuries": [{"region": inj["region"], "description": inj["description"], "severity": inj["severity"]} for inj in injuries],
        "toxicology": [{"substance": s, "detected": True, "level": random.choice(["trace", "therapeutic", "above therapeutic", "lethal"])} for s in substances],
        "cause_of_death": random.choice([
            "Blunt force trauma to cranial region",
            "Asphyxiation due to ligature strangulation",
            "Exsanguination from stab wounds",
            "Blunt force trauma with internal hemorrhage",
            "Drug-induced cardiorespiratory failure",
        ]),
        "manner_of_death": random.choice(["homicide", "homicide", "suicide", "accident"]),  # weighted homicide
        "tod_estimate": f"{tod_start} ± {round(tod_window/2, 1)}h",
        "report_text": _make_report_text(subject, age, body_temp, ambient_temp, injuries, substances, pmi),
    }


def _make_report_text(name, age, bt, at, injuries, substances, pmi) -> str:
    inj_text = "\n".join(f"  {i+1}. {inj['region']}: {inj['description']} [{inj['severity']}]" for i, inj in enumerate(injuries))
    tox_text = ", ".join(substances) if substances else "None detected"
    return f"""POSTMORTEM EXAMINATION REPORT

Subject: {name} | Age: {age}
Body Temperature at Scene: {bt}°C | Ambient Temperature: {at}°C
Postmortem Interval (estimated): {pmi} hours

INJURIES IDENTIFIED:
{inj_text}

TOXICOLOGY (Preliminary): {tox_text}

RIGOR MORTIS: {'Full rigor present in all muscle groups.' if pmi > 8 else 'Partial rigor — early stage.'}
LIVOR MORTIS: {'Fixed pattern suggesting body repositioned post-mortem.' if random.random() > 0.5 else 'Fixed posterior — no repositioning detected.'}

FORENSIC NOTES:
The pattern of injuries and postmortem indicators are consistent with {
    'a premeditated assault by an attacker known to the victim' if random.random() > 0.4
    else 'a spontaneous violent altercation'
}. Toxicological findings {'suggest victim was sedated prior to the fatal assault.' if substances else 'show no intoxicating substances.'}
"""


def make_gps_log(i: int) -> dict:
    base_lat = 12.9716 + random.uniform(-0.1, 0.1)
    base_lng = 77.5946 + random.uniform(-0.1, 0.1)
    device_id = f"DEVICE_{random.randint(10,99)}"
    pings = []
    t = datetime(2025, 5, 22, 1, 30)
    for _ in range(random.randint(8, 25)):
        lat = base_lat + random.uniform(-0.02, 0.02)
        lng = base_lng + random.uniform(-0.02, 0.02)
        speed = random.uniform(0, 80)
        # Inject anomaly: sudden route deviation
        if random.random() < 0.15:
            lat += random.uniform(0.05, 0.12)
            speed = random.uniform(60, 110)
        pings.append({
            "timestamp": t.strftime("%Y-%m-%dT%H:%M:%S"),
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "speed_kmh": round(speed, 1),
            "accuracy_m": random.randint(5, 50),
            "tower_id": random.choice(TOWER_IDS),
        })
        t += timedelta(minutes=random.randint(1, 8))

    return {
        "id": f"GPS-{i:04d}",
        "device_id": device_id,
        "case_id": f"AIV-{random.randint(2000,2099)}-{random.randint(10,99)}",
        "owner": random.choice(NAMES),
        "date": "2025-05-22",
        "pings": pings,
        "anomalies_detected": any(p["speed_kmh"] > 90 for p in pings),
        "total_pings": len(pings),
        "coverage_area_km2": round(random.uniform(0.5, 15.0), 2),
    }


def make_cctv_log(i: int) -> dict:
    camera_id = random.choice(CAMERA_IDS)
    location = random.choice(LOCATIONS_BLR)
    events = []
    t = datetime(2025, 5, 22, 1, 45)
    for _ in range(random.randint(3, 12)):
        events.append({
            "timestamp": t.strftime("%Y-%m-%dT%H:%M:%S"),
            "event_type": random.choice(["PERSON_DETECTED", "VEHICLE_DETECTED", "FACE_MATCH", "UNKNOWN_SUBJECT"]),
            "subject_description": random.choice([
                "Male, dark clothing, approximately 25-35",
                "Female, red jacket, carrying bag",
                "Male, white shirt, partially obscured",
                "Vehicle: White SUV, partial plate visible",
                "Unknown subject, face obscured",
            ]),
            "confidence": round(random.uniform(0.72, 0.99), 2),
            "face_match": random.random() < 0.3,
            "matched_id": random.choice(NAMES) if random.random() < 0.3 else None,
            "duration_seconds": random.randint(3, 120),
        })
        t += timedelta(minutes=random.randint(2, 20))

    return {
        "id": f"CCTV-{i:04d}",
        "camera_id": camera_id,
        "location": location,
        "case_id": f"AIV-{random.randint(2000,2099)}-{random.randint(10,99)}",
        "date": "2025-05-22",
        "events": events,
        "total_events": len(events),
        "has_face_match": any(e["face_match"] for e in events),
        "has_vehicle": any(e["event_type"] == "VEHICLE_DETECTED" for e in events),
    }


def make_call_log(i: int) -> dict:
    owner = random.choice(NAMES)
    calls = []
    t = datetime(2025, 5, 22, 0, 30)
    last_call_end = None
    for _ in range(random.randint(5, 20)):
        duration = random.randint(10, 600)
        calls.append({
            "timestamp": t.strftime("%Y-%m-%dT%H:%M:%S"),
            "call_type": random.choice(["OUTGOING", "INCOMING", "MISSED"]),
            "callee": f"+91-{random.randint(7000000000, 9999999999)}",
            "duration_seconds": duration,
            "tower_id": random.choice(TOWER_IDS),
            "signal_strength_dbm": random.randint(-100, -50),
        })
        last_call_end = t + timedelta(seconds=duration)
        t += timedelta(minutes=random.randint(5, 45))

    # Inject suspicious silence gap
    silence_start_idx = random.randint(len(calls)//2, max(len(calls)//2, len(calls)-3))
    silence_duration_min = random.randint(20, 60)
    silence_gap = {
        "gap_start": calls[silence_start_idx]["timestamp"] if silence_start_idx < len(calls) else "",
        "gap_duration_minutes": silence_duration_min,
        "anomaly": "suspicious_silence",
    }

    return {
        "id": f"CALL-{i:04d}",
        "device_owner": owner,
        "phone_number": f"+91-{random.randint(7000000000, 9999999999)}",
        "case_id": f"AIV-{random.randint(2000,2099)}-{random.randint(10,99)}",
        "date": "2025-05-22",
        "calls": calls,
        "total_calls": len(calls),
        "silence_gaps": [silence_gap],
        "suspicious_activity": True,
    }


def make_env_report(i: int) -> dict:
    location = random.choice(LOCATIONS_BLR)
    readings = []
    t = datetime(2025, 5, 22, 0, 0)
    for h in range(8):
        readings.append({
            "timestamp": t.strftime("%Y-%m-%dT%H:%M:%S"),
            "temperature_celsius": round(random.uniform(20.0, 32.0), 1),
            "humidity_percent": round(random.uniform(55, 90), 1),
            "wind_speed_kmh": round(random.uniform(0, 15), 1),
            "precipitation_mm": round(random.uniform(0, 2), 1),
            "visibility_m": random.randint(500, 5000),
        })
        t += timedelta(hours=1)

    return {
        "id": f"ENV-{i:04d}",
        "location": location,
        "case_id": f"AIV-{random.randint(2000,2099)}-{random.randint(10,99)}",
        "date": "2025-05-22",
        "readings": readings,
        "avg_temperature": round(sum(r["temperature_celsius"] for r in readings) / len(readings), 1),
        "report_text": f"Environmental conditions at {location} on 22 May 2025. "
                       f"Temperature ranged {min(r['temperature_celsius'] for r in readings)}°C to "
                       f"{max(r['temperature_celsius'] for r in readings)}°C. "
                       f"Humidity: {readings[0]['humidity_percent']}% at midnight.",
    }


def make_case_file(i: int) -> dict:
    suspect_name = random.choice(NAMES)
    victim_name = random.choice([n for n in NAMES if n != suspect_name])
    case_date = (datetime(2025, 5, 1) + timedelta(days=random.randint(0, 120)))

    return {
        "id": f"CASE-{i:04d}",
        "case_id": f"AIV-{random.randint(2000,2099)}-{random.randint(10,99)}",
        "case_date": case_date.strftime("%Y-%m-%d"),
        "victim": {
            "name": victim_name,
            "age": random.randint(18, 65),
            "occupation": random.choice(["Software Engineer", "Teacher", "Business Owner", "Student", "Doctor"]),
            "last_seen": (case_date - timedelta(hours=random.randint(6, 48))).strftime("%Y-%m-%dT%H:%M:%S"),
        },
        "suspects": [
            {
                "id": f"SUSPECT_{j+1:02d}",
                "name": random.choice([n for n in NAMES if n != victim_name]),
                "age": random.randint(20, 55),
                "relationship_to_victim": random.choice(["acquaintance", "colleague", "ex-partner", "neighbor", "unknown"]),
                "alibi": random.choice(["At home — unverified", "Working late — colleagues confirm", "No alibi provided"]),
                "risk_score": round(random.uniform(40, 95), 1),
            }
            for j in range(random.randint(1, 3))
        ],
        "evidence_count": random.randint(3, 12),
        "status": random.choice(["ACTIVE", "CLOSED", "SUSPENDED"]),
        "risk_level": random.choice(["HIGH", "ELEVATED", "MODERATE"]),
        "summary": f"Case involving {victim_name}. Investigation ongoing. "
                   f"Key evidence collected from {random.choice(LOCATIONS_BLR)}. "
                   f"Primary suspect: {suspect_name}.",
        "entities": {
            "suspects": [suspect_name],
            "locations": random.sample(LOCATIONS_BLR, 3),
            "devices": [f"DEVICE_{random.randint(10,99)}" for _ in range(random.randint(1, 4))],
        },
    }


def make_suspect_profile(i: int) -> dict:
    name = random.choice(NAMES)
    known_locations = random.sample(LOCATIONS_BLR, 3)
    device_ids = [f"DEVICE_{random.randint(10,99)}" for _ in range(random.randint(1, 3))]
    risk = round(random.uniform(35, 96), 1)
    anomaly_flags = random.sample(
        [
            "unverified alibi during postmortem interval",
            "device powered down inside critical window",
            "vehicle observed near secondary deposition route",
            "prior communication spike with victim",
            "GPS route intersects CCTV blind zone",
            "financial stressor detected in recent records",
        ],
        random.randint(2, 4),
    )
    return {
        "id": f"SUS-{i:04d}",
        "name": name,
        "age": random.randint(20, 58),
        "relationship_to_victim": random.choice(["colleague", "ex-partner", "neighbor", "business associate", "unknown"]),
        "known_locations": known_locations,
        "registered_devices": device_ids,
        "vehicle": {
            "type": random.choice(["White SUV", "Black hatchback", "Grey sedan", "Blue motorcycle"]),
            "partial_plate": f"KA-{random.randint(1, 9):02d}-{random.choice(['AB','CD','MN','ZX'])}",
        },
        "behavioral_baseline": {
            "night_activity_level": random.choice(["low", "moderate", "high"]),
            "normal_call_frequency_per_hour": round(random.uniform(0.5, 7.5), 1),
            "usual_radius_km": round(random.uniform(2.0, 18.0), 1),
        },
        "anomaly_flags": anomaly_flags,
        "risk_score": risk,
        "risk_level": "CRITICAL" if risk >= 90 else "HIGH" if risk >= 70 else "ELEVATED" if risk >= 50 else "MODERATE",
        "explainable_conflicts": [
            {
                "conflict": "claimed location conflicts with tower registration",
                "supporting_source": random.choice(["gps_logs", "call_logs", "cctv_logs"]),
                "confidence": round(random.uniform(72, 97), 1),
            },
            {
                "conflict": "communication silence overlaps reconstructed TOD window",
                "supporting_source": "call_logs",
                "confidence": round(random.uniform(78, 96), 1),
            },
        ],
    }


def main():
    SYNTHETIC_DIR.mkdir(parents=True, exist_ok=True)
    subdirs = [
        "autopsy_reports",
        "gps_logs",
        "cctv_logs",
        "call_logs",
        "environmental_reports",
        "suspect_profiles",
        "case_files",
    ]
    for s in subdirs:
        (SYNTHETIC_DIR / s).mkdir(exist_ok=True)

    print("Generating synthetic datasets...")

    for i in range(1, 51):
        ar = make_autopsy(i)
        with open(SYNTHETIC_DIR / "autopsy_reports" / f"autopsy_{i:04d}.json", "w") as f:
            json.dump(ar, f, indent=2)

    for i in range(1, 101):
        gps = make_gps_log(i)
        with open(SYNTHETIC_DIR / "gps_logs" / f"gps_{i:04d}.json", "w") as f:
            json.dump(gps, f, indent=2)

    for i in range(1, 101):
        cctv = make_cctv_log(i)
        with open(SYNTHETIC_DIR / "cctv_logs" / f"cctv_{i:04d}.json", "w") as f:
            json.dump(cctv, f, indent=2)

    for i in range(1, 51):
        call = make_call_log(i)
        with open(SYNTHETIC_DIR / "call_logs" / f"call_{i:04d}.json", "w") as f:
            json.dump(call, f, indent=2)

    for i in range(1, 31):
        env = make_env_report(i)
        with open(SYNTHETIC_DIR / "environmental_reports" / f"env_{i:04d}.json", "w") as f:
            json.dump(env, f, indent=2)

    for i in range(1, 26):
        suspect = make_suspect_profile(i)
        with open(SYNTHETIC_DIR / "suspect_profiles" / f"suspect_{i:04d}.json", "w") as f:
            json.dump(suspect, f, indent=2)

    for i in range(1, 21):
        case = make_case_file(i)
        with open(SYNTHETIC_DIR / "case_files" / f"case_{i:04d}.json", "w") as f:
            json.dump(case, f, indent=2)

    # Count
    total = sum(
        len(list((SYNTHETIC_DIR / s).glob("*.json"))) for s in subdirs
    )
    print(f"Done! Generated {total} synthetic files across {len(subdirs)} categories.")
    print(f"Location: {SYNTHETIC_DIR.absolute()}")


if __name__ == "__main__":
    main()
