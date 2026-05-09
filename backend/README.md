# AIVENTRA Backend

AI-powered forensic triage and postmortem intelligence backend for the completed Next.js frontend.

## Stack

- FastAPI on Python 3.11
- Featherless AI OpenAI-compatible API
- Primary model: `meta-llama/Meta-Llama-3-8B-Instruct`
- Backup model: `mistral-community/Mistral-7B-Instruct-v0.3`
- Embeddings: `sentence-transformers/all-MiniLM-L6-v2`
- Local FAISS vector search
- Local JSON storage only

## Setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

The checked-in `.env` contains the Featherless configuration:

```bash
FEATHERLESS_API_KEY=YOUR_FEATHERLESS_API_KEY
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
PRIMARY_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
BACKUP_MODEL=mistral-community/Mistral-7B-Instruct-v0.3
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

## Synthetic Data

```bash
python generate_synthetic.py
```

This creates:

- 50 autopsy reports
- 100 GPS logs
- 100 CCTV logs
- 50 call logs
- 30 environmental reports
- 25 suspect profiles
- 20 case files

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Docs are available at `http://localhost:8000/docs`.

## Prime RAG

```bash
curl -X POST http://localhost:8000/api/rag/index-synthetic
```

## Core API Tests

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/autopsy/analyze \
  -H "Content-Type: application/json" \
  -d '{"report_text":"Postmortem report: blunt cranial trauma, fixed lividity, benzodiazepine positive, estimated death 02:00-04:00."}'

curl -X POST http://localhost:8000/timeline/reconstruct \
  -H "Content-Type: application/json" \
  -d '{"gps_logs":[],"cctv_logs":[],"mobile_metadata":[],"timestamps":["2025-05-22T02:14:00"]}'

curl -X POST http://localhost:8000/correlation/build \
  -H "Content-Type: application/json" \
  -d '{"suspects":["SUSPECT_01"],"devices":["DEVICE_45"],"locations":["Whitefield service road"],"timestamps":["02:14"]}'

curl -X POST http://localhost:8000/anomaly/detect \
  -H "Content-Type: application/json" \
  -d '{"gps":"route deviation","calls":"27 minute silence","metadata":"tower conflict"}'

curl -X POST http://localhost:8000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question":"Why is the communication silence suspicious?","top_k":5}'

curl -X POST http://localhost:8000/report/generate \
  -H "Content-Type: application/json" \
  -d '{"case_id":"AIV-2041-77"}'
```

The same routes are also available with `/api`, for example `/api/health` and `/api/rag/query`.

## Upload

```bash
curl -X POST http://localhost:8000/upload \
  -F "case_id=AIV-2041-77" \
  -F "file=@sample.pdf"
```

Supported evidence files: PDF, CSV, JSON, JPEG, PNG, TIFF, and text.

## WebSocket Testing

```bash
npx wscat -c ws://localhost:8000/ws/AIV-2041-77
```

Send:

```json
{"action":"start_analysis"}
```

The stream emits:

- decrypting evidence
- extracting entities
- building evidence graph
- reconstructing timeline
- detecting anomalies
- generating verdict

## Frontend Connection

Set the frontend API base URL to:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

The backend also exposes bare paths for direct hackathon testing.

## Notes

No local model runtime is required. LLM inference uses Featherless AI, while embeddings and FAISS search run locally for efficient RAG. If the Featherless API is temporarily unreachable, deterministic forensic fallbacks keep demos functional.
