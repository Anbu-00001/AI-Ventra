# AIVENTRA: AI-Powered Forensic Intelligence System


[![License: MIT](https://img.shields.io/badge/License-MIT-crimson.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-000000.svg)](https://www.python.org/)
[![Next.js 14](https://img.shields.io/badge/next.js-14-000000.svg)](https://nextjs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-crimson.svg)](https://ollama.ai/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg)](https://tailwindcss.com/)

**AIVENTRA** is a state-of-the-art forensic triage and postmortem intelligence platform designed for law enforcement and digital forensic units. It leverages localized neural networks, vector-based reasoning, and advanced computer vision to reconstruct crime timelines and detect behavioral anomalies with surgical precision.

---

## 🛡️ Core Intelligence Pillars

### 1. Visual Intelligence (CCTV AI)
Integrates **YOLOv8** for real-time object detection and a custom **MobileNetV2** threat classifier. It doesn't just see objects; it understands *intent*—identifying high-threat behaviors like assault, robbery, or unauthorized access in surveillance feeds.

### 2. Forensic RAG (Local LLM)
Uses **Ollama** (Llama 3 / Mistral) coupled with **FAISS/ChromaDB** to provide a privacy-first, offline-capable knowledge base. Investigators can query thousands of pages of case files, autopsy reports, and logs using natural language.

### 3. Correlation Engine
A high-dimensional graph analysis system that links disparate data points—GPS logs, call metadata, and digital traces—to reveal hidden relationships and temporal overlaps between suspects and locations.

### 4. Automated Triage
Generates court-admissible forensic summaries, reconstructing timelines from raw telemetry and providing AI-assisted verdicts backed by a deterministic reasoning engine.

---

## 📊 System Architecture

```mermaid
graph TD
    subgraph "Evidence Ingestion"
        A[Digital Traces] --> E[Unified Data Gate]
        B[CCTV Streams] --> E
        C[Autopsy Reports] --> E
        D[Geospatial Logs] --> E
    end

    subgraph "Processing Layer"
        E --> F{Forensic Orchestrator}
        F --> G[YOLOv8 + ML Vision]
        F --> H[Local LLM - Ollama]
        F --> I[Vector Store - FAISS]
        G --> J[Behavioral Classification]
        H --> K[Contextual Reasoning]
        I --> L[Semantic Search]
    end

    subgraph "Intelligence Output"
        J --> M[Forensic Dashboard]
        K --> M
        L --> M
        M --> N[Court-Ready Report]
        M --> O[Real-time Timeline]
    end

    style AIVENTRA fill:#C0182A,stroke:#fff,stroke-width:2px,color:#fff
    style N fill:#0A0A0F,stroke:#C0182A,stroke-width:2px,color:#fff
```

---

## 🛠️ Tech Stack & Tools

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14, TypeScript, Tailwind | Glassmorphism UI with high-performance rendering |
| **Backend** | FastAPI, Python 3.11 | High-concurrency async forensic pipeline |
| **Intelligence** | Ollama (Llama 3, Mistral) | Local LLM inference for data privacy |
| **Computer Vision** | YOLOv8, OpenCV, PyTorch | Real-time object and behavioral analysis |
| **Vector DB** | FAISS, ChromaDB | High-speed semantic indexing of evidence |
| **Real-time** | WebSockets | Live streaming of analysis progress and telemetry |
| **Styling** | Vanilla CSS, Framer Motion | Premium, dynamic micro-animations |

---

## 🚀 Getting Started

### 1. Clone & Environment
```bash
git clone https://github.com/Anbu-00001/AI-Ventra.git
cd AI-Ventra
```

### 2. Local AI Engine (Ollama)
Ensure Ollama is installed and running, then prime the models:
```bash
chmod +x setup_ollama.sh
./setup_ollama.sh
```

### 3. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend Setup
```bash
cd aiventra
npm install
npm run dev
```

---

## 🔍 Forensic Workflow

```mermaid
sequenceDiagram
    participant I as Investigator
    participant B as AIVentra Backend
    participant V as Vision Engine
    participant L as LLM Engine
    
    I->>B: Upload Evidence (Video/JSON/PDF)
    B->>V: Process Frames (YOLO + ML)
    V-->>B: Detect Entities & Behaviors
    B->>L: Embed & Index (RAG)
    I->>B: Query Case ("Where was the suspect at 02:14?")
    B->>L: Contextual Retrieval
    L-->>B: Generated Response + Confidence Score
    B->>I: Interactive Timeline & Visual Report
```

---

## 📈 Forensic Dashboard Capabilities

- **Neural Pattern Matching**: Identifying signatures of known criminal tactics.
- **Deep Packet Forensics**: Analyzing digital communication traces.
- **Geospatial Mesh**: Real-time tracking of entities across jurisdictions.
- **Autonomous Case Building**: Self-assembling evidence chains.

---

## 🔮 Future Roadmap

- [ ] **Quantum-Resistant Encryption**: Sealing evidence with post-quantum security.
- [ ] **Predictive Threat Modeling**: Identifying emerging threats before materialization.
- [ ] **Digital Twin Simulation**: 3D reconstruction of crime scenes for forensic walkthroughs.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  <b>Built for the future of justice. Powered by AIVENTRA.</b>
</p>
