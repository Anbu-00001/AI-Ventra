// ===== COLOR TOKENS =====
export const COLORS = {
  base: "#050508",
  surface: "#0A0A0F",
  crimson: "#C0182A",
  crimsonGlow: "#FF1A3C",
  amber: "#F59E0B",
  amberGlow: "#FCD34D",
  teal: "#14B8A6",
  pure: "#F8FAFC",
  muted: "#94A3B8",
  dim: "#475569",
} as const;

// ===== HERO METRICS =====
export const HERO_METRICS = [
  { value: 24847, label: "Cases Analyzed", prefix: "", suffix: "" },
  { value: 99.7, label: "Pattern Accuracy", prefix: "", suffix: "%" },
  { value: 3.2, label: "Avg Triage Time", prefix: "", suffix: "s" },
  { value: 142, label: "Active Investigations", prefix: "", suffix: "" },
] as const;

// ===== WORKFLOW STEPS =====
export const WORKFLOW_STEPS = [
  {
    id: 1,
    title: "Evidence Ingestion",
    description: "Automated multi-source data collection from digital and physical evidence streams.",
    icon: "Database",
  },
  {
    id: 2,
    title: "AI Preprocessing",
    description: "Neural networks clean, classify, and structure raw forensic data in real-time.",
    icon: "Cpu",
  },
  {
    id: 3,
    title: "Correlation Engine",
    description: "Cross-reference analysis across 142+ data dimensions using graph neural networks.",
    icon: "GitBranch",
  },
  {
    id: 4,
    title: "Pattern Detection",
    description: "Anomaly detection algorithms identify hidden relationships and behavioral deviations.",
    icon: "ScanSearch",
  },
  {
    id: 5,
    title: "Actionable Report",
    description: "Generate court-admissible intelligence reports with AI confidence scoring.",
    icon: "FileText",
  },
] as const;

// ===== CORRELATION GRAPH NODES =====
export const GRAPH_NODES = [
  { id: "s1", label: "John Doe", type: "suspect", x: 300, y: 200 },
  { id: "s2", label: "Jane Smith", type: "suspect", x: 500, y: 100 },
  { id: "s3", label: "Unknown Actor", type: "suspect", x: 700, y: 250 },
  { id: "l1", label: "Warehouse B", type: "location", x: 200, y: 350 },
  { id: "l2", label: "Port Terminal 7", type: "location", x: 450, y: 400 },
  { id: "l3", label: "Safe House", type: "location", x: 650, y: 380 },
  { id: "d1", label: "Burner Phone #1", type: "digital", x: 150, y: 150 },
  { id: "d2", label: "Encrypted Drive", type: "digital", x: 400, y: 280 },
  { id: "d3", label: "Email Server", type: "digital", x: 600, y: 150 },
  { id: "d4", label: "Crypto Wallet", type: "digital", x: 750, y: 120 },
  { id: "t1", label: "02:34 AM", type: "timestamp", x: 250, y: 450 },
  { id: "t2", label: "14:17 PM", type: "timestamp", x: 550, y: 450 },
] as const;

export const GRAPH_EDGES = [
  { source: "s1", target: "d1", strength: 0.9 },
  { source: "s1", target: "l1", strength: 0.7 },
  { source: "s2", target: "d3", strength: 0.85 },
  { source: "s2", target: "l2", strength: 0.6 },
  { source: "s3", target: "d4", strength: 0.95 },
  { source: "s3", target: "l3", strength: 0.8 },
  { source: "d1", target: "d2", strength: 0.5 },
  { source: "d2", target: "d3", strength: 0.65 },
  { source: "l1", target: "t1", strength: 0.75 },
  { source: "l2", target: "t2", strength: 0.7 },
  { source: "s1", target: "s2", strength: 0.4 },
  { source: "d3", target: "d4", strength: 0.55 },
  { source: "l1", target: "l2", strength: 0.3 },
  { source: "s2", target: "s3", strength: 0.6 },
  { source: "d2", target: "l2", strength: 0.45 },
] as const;

// ===== TIMELINE EVENTS =====
export const TIMELINE_EVENTS = [
  {
    id: 1,
    timestamp: "01:52 AM",
    type: "PHONE ACTIVITY",
    title: "PHONE ACTIVITY",
    description: "Last outgoing call from victim's phone",
    confidence: 92,
    icon: "Phone",
    color: "slate",
    image: null
  },
  {
    id: 2,
    timestamp: "02:05 AM",
    type: "CCTV FOOTAGE",
    title: "CCTV FOOTAGE",
    description: "Victim seen near Phoenix Mall Entrance Cam_07",
    confidence: 88,
    icon: "Camera",
    color: "cyan",
    image: "/images/cctv-1.jpg"
  },
  {
    id: 3,
    timestamp: "02:14 AM",
    type: "SIGNAL DISCONNECT",
    title: "SIGNAL DISCONNECT",
    description: "Mobile signal disconnected suddenly. Tower ID: BLR_2231",
    confidence: 96,
    icon: "WifiOff",
    color: "red",
    image: null
  },
  {
    id: 4,
    timestamp: "02:17 AM",
    type: "VEHICLE MOVEMENT",
    title: "VEHICLE MOVEMENT",
    description: "White SUV detected leaving the area towards ORR. Speed: 48 km/h",
    confidence: 92,
    icon: "Car",
    color: "orange",
    image: "/images/car-1.jpg",
    direction: "NE"
  },
  {
    id: 5,
    timestamp: "02:26 AM",
    type: "LOCATION PING",
    title: "LOCATION PING",
    description: "Device ping near service road Whitefield. Accuracy: 12m",
    confidence: 85,
    icon: "MapPin",
    color: "purple",
    image: null
  },
  {
    id: 6,
    timestamp: "02:38 AM",
    type: "ANOMALY SPIKE",
    title: "ANOMALY SPIKE",
    description: "Abnormal activity detected in target's behavior pattern. Severity: HIGH",
    confidence: 89,
    icon: "Activity",
    color: "red",
    image: null
  },
  {
    id: 7,
    timestamp: "02:38 AM",
    type: "CCTV FOOTAGE",
    title: "CCTV FOOTAGE",
    description: "Suspect captured on camera near abandoned lot Cam_12",
    confidence: 94,
    icon: "Camera",
    color: "cyan",
    image: "/images/cctv-2.jpg"
  },
  {
    id: 8,
    timestamp: "03:30 AM",
    type: "DEVICE INACTIVE",
    title: "DEVICE INACTIVE",
    description: "Device turned off or battery removed",
    confidence: 98,
    icon: "BatteryLow",
    color: "slate",
    image: null
  }
] as const;

// ===== ANOMALY CHART DATA =====
export const ANOMALY_DATA = Array.from({ length: 60 }, (_, i) => ({
  time: i,
  normal: 20 + Math.sin(i * 0.3) * 5 + Math.random() * 3,
  anomaly:
    i === 15 ? 78 :
    i === 16 ? 65 :
    i === 32 ? 85 :
    i === 33 ? 72 :
    i === 48 ? 92 :
    i === 49 ? 68 :
    null,
}));

// ===== DETECTION CARDS =====
export const DETECTION_CARDS = [
  { title: "Behavioral Deviation", progress: 87, status: "CRITICAL" },
  { title: "Digital Trace Correlation", progress: 94, status: "CONFIRMED" },
  { title: "Temporal Anomaly", progress: 72, status: "ANALYZING" },
] as const;

// ===== GLOBAL NETWORK CITIES =====
export const NETWORK_CITIES = [
  { name: "Washington D.C.", lat: 38.9, lng: -77.0, cases: 847, agency: "FBI Cyber Division" },
  { name: "London", lat: 51.5, lng: -0.1, cases: 623, agency: "GCHQ Intelligence" },
  { name: "Tokyo", lat: 35.7, lng: 139.7, cases: 412, agency: "NPA Digital Forensics" },
  { name: "Berlin", lat: 52.5, lng: 13.4, cases: 389, agency: "BKA Cybercrime Unit" },
  { name: "Singapore", lat: 1.3, lng: 103.8, cases: 534, agency: "CSA Threat Intelligence" },
  { name: "Sydney", lat: -33.9, lng: 151.2, cases: 278, agency: "AFP Cyber Operations" },
  { name: "Tel Aviv", lat: 32.1, lng: 34.8, cases: 456, agency: "Unit 8200 Analytics" },
  { name: "Dubai", lat: 25.2, lng: 55.3, cases: 312, agency: "Dubai Police AI Lab" },
  { name: "Seoul", lat: 37.6, lng: 127.0, cases: 367, agency: "KISA Forensic Center" },
  { name: "São Paulo", lat: -23.5, lng: -46.6, cases: 198, agency: "PF Digital Investigation" },
  { name: "Paris", lat: 48.9, lng: 2.3, cases: 445, agency: "DGSI Cyber Intelligence" },
  { name: "Mumbai", lat: 19.1, lng: 72.9, cases: 267, agency: "CBI Cyber Forensics" },
  { name: "Toronto", lat: 43.7, lng: -79.4, cases: 334, agency: "RCMP Cyber Unit" },
  { name: "Nairobi", lat: -1.3, lng: 36.8, cases: 145, agency: "DCI Digital Lab" },
] as const;

export const NETWORK_CONNECTIONS = [
  { from: 0, to: 1 }, { from: 0, to: 4 }, { from: 0, to: 12 },
  { from: 1, to: 3 }, { from: 1, to: 10 }, { from: 2, to: 4 },
  { from: 2, to: 8 }, { from: 3, to: 10 }, { from: 4, to: 6 },
  { from: 4, to: 11 }, { from: 5, to: 4 }, { from: 6, to: 7 },
  { from: 7, to: 11 }, { from: 8, to: 2 }, { from: 9, to: 0 },
  { from: 10, to: 6 }, { from: 11, to: 7 }, { from: 12, to: 1 },
  { from: 13, to: 1 }, { from: 13, to: 7 },
] as const;

// ===== FUTURE CAPABILITIES =====
export const FUTURE_CAPABILITIES = [
  {
    title: "Autonomous Case Building",
    description: "Self-assembling investigation frameworks that autonomously gather, correlate, and structure evidence chains without human intervention.",
    icon: "Bot",
    status: "ACTIVE",
  },
  {
    title: "Quantum-Encrypted Evidence Chain",
    description: "Post-quantum cryptographic sealing of digital evidence ensuring tamper-proof chain of custody across jurisdictions.",
    icon: "Lock",
    status: "COMING SOON",
  },
  {
    title: "Predictive Threat Modeling",
    description: "Pre-crime analytics using behavioral pattern recognition to identify emerging threats before they materialize.",
    icon: "TrendingUp",
    status: "COMING SOON",
  },
] as const;

// ===== CAPABILITY TICKER TAGS =====
export const TICKER_TAGS = [
  "NEURAL PATTERN MATCHING",
  "DEEP PACKET FORENSICS",
  "BEHAVIORAL BIOMETRICS",
  "REAL-TIME GEOSPATIAL TRACKING",
  "QUANTUM-RESISTANT ENCRYPTION",
  "AUTOMATED EVIDENCE CHAIN",
  "MULTI-JURISDICTIONAL SYNC",
  "DARK WEB INTELLIGENCE",
  "AI-POWERED TRIAGE",
  "PREDICTIVE ANALYTICS",
  "DIGITAL TWIN SIMULATION",
  "CROSS-AGENCY MESH NETWORK",
] as const;

// ===== NAV LINKS =====
export const NAV_LINKS = [
  { label: "Platform", href: "#workflow" },
  { label: "Intelligence", href: "#evidence" },
  { label: "Analytics", href: "#timeline" },
  { label: "Security", href: "#anomaly" },
  { label: "Agency", href: "#network" },
] as const;

// ===== FOOTER LINKS =====
export const FOOTER_LINKS = {
  platform: [
    { label: "Evidence Engine", href: "#" },
    { label: "AI Triage System", href: "#" },
    { label: "Case Management", href: "#" },
    { label: "Report Generator", href: "#" },
  ],
  intelligence: [
    { label: "Threat Analysis", href: "#" },
    { label: "Pattern Detection", href: "#" },
    { label: "Network Mapping", href: "#" },
    { label: "Behavioral Profiling", href: "#" },
  ],
  legal: [
    { label: "Classification Policy", href: "#" },
    { label: "Data Sovereignty", href: "#" },
    { label: "Agency Compliance", href: "#" },
    { label: "Audit Protocols", href: "#" },
  ],
} as const;

// ===== EVIDENCE CARDS (Hero floating) =====
export const EVIDENCE_CARDS = [
  {
    id: "EV-2024-0847",
    type: "Digital Forensics",
    status: "PROCESSING",
    detail: "Encrypted disk image — AES-256 decryption in progress",
    confidence: 87,
  },
  {
    id: "EV-2024-0848",
    type: "Network Analysis",
    status: "FLAGGED",
    detail: "Anomalous traffic pattern from 14 endpoints detected",
    confidence: 94,
  },
  {
    id: "EV-2024-0849",
    type: "Behavioral Pattern",
    status: "CONFIRMED",
    detail: "Subject communication deviation score: 9.2/10",
    confidence: 96,
  },
] as const;
