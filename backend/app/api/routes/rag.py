"""
RAG (Retrieval-Augmented Generation) API.
Semantic evidence search + AI explanation.
"""
from fastapi import APIRouter, Body, Query
from app.services.rag.contextual_query import query_with_context
from app.services.rag.explanation_engine import explain_conclusion
from app.services.rag.retriever import retrieve
from app.services.rag.vector_store import vector_store
from app.utils.response_utils import success

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/query")
async def rag_query(
    question: str = Body(..., embed=True),
    top_k: int = Body(5, embed=True),
):
    """Query the evidence corpus with semantic search + LLM synthesis."""
    result = await query_with_context(question, top_k=top_k)
    return success(result, message="RAG query complete")


@router.post("/explain")
async def explain(
    conclusion: str = Body(..., embed=True),
    top_k: int = Body(5, embed=True),
):
    """Explain why the AI reached a given forensic conclusion."""
    result = await explain_conclusion(conclusion, top_k=top_k)
    return success(result, message="Explainability report generated")


@router.get("/search")
async def semantic_search(
    q: str = Query(..., description="Search query"),
    k: int = Query(5, description="Number of results"),
):
    """Perform raw semantic similarity search against evidence corpus."""
    results = await retrieve(q, k=k)
    return success(
        {"query": q, "results": results, "total": len(results)},
        message=f"{len(results)} evidence chunks retrieved",
    )


@router.get("/stats")
async def rag_stats():
    """Return FAISS index statistics."""
    return success({
        "total_vectors": vector_store.total_vectors,
        "dimension": vector_store.dimension,
        "status": "ready" if vector_store.total_vectors > 0 else "empty",
    })


@router.post("/index-synthetic")
async def index_synthetic_data():
    """
    Index all synthetic datasets into FAISS.
    Call this once after startup to prime the RAG system.
    """
    from app.services.ingestion.storage_service import load_all_synthetic
    from app.services.rag.chunker import chunk_with_metadata
    from app.services.rag.embeddings import embed_texts
    import json

    indexed = 0
    # Mapping of subdirectory to preferred text key or custom stringifier
    datasets = [
        ("autopsy_reports", "report_text"),
        ("case_files", "summary"),
        ("environmental_reports", "report_text"),
        ("suspect_profiles", None),
        ("cctv_logs", None),
        ("call_logs", None),
        ("gps_logs", None),
    ]

    def record_to_text(rec: dict, subdir: str) -> str:
        """Convert a complex forensic record into a descriptive text block for indexing."""
        if subdir == "suspect_profiles":
            return f"Suspect Profile: {rec.get('name')}, Age: {rec.get('age')}. Relationship: {rec.get('relationship_to_victim')}. Risk: {rec.get('risk_level')}. Bio: {rec.get('behavioral_baseline')}. Conflicts: {json.dumps(rec.get('explainable_conflicts'))}"
        if subdir == "cctv_logs":
            return f"CCTV Log {rec.get('id')} from {rec.get('camera_id')} at {rec.get('location')}. Date: {rec.get('date')}. Events: {json.dumps(rec.get('events'))}"
        if subdir == "call_logs":
            return f"Call Logs for {rec.get('device_owner')} ({rec.get('phone_number')}). Date: {rec.get('date')}. Suspicious: {rec.get('suspicious_activity')}. Gaps: {json.dumps(rec.get('silence_gaps'))}. Summary: {len(rec.get('calls', []))} total calls."
        if subdir == "gps_logs":
            return f"GPS Trace for {rec.get('owner')} (Device: {rec.get('device_id')}). Date: {rec.get('date')}. Anomalies: {rec.get('anomalies_detected')}. Coverage: {rec.get('coverage_area_km2')} km2. Total Pings: {rec.get('total_pings')}."
        
        # Fallback for other types
        return json.dumps(rec, indent=2)

    for subdir, text_key in datasets:
        records = load_all_synthetic(subdir)
        for rec in records:
            if text_key and rec.get(text_key):
                text = rec.get(text_key)
            else:
                text = record_to_text(rec, subdir)
            
            file_id = rec.get("id") or rec.get("report_id") or rec.get("case_id") or subdir
            chunks = chunk_with_metadata(text, subdir, str(file_id))
            if chunks:
                embeddings = await embed_texts([c["text"] for c in chunks])
                vector_store.add(embeddings, chunks)
                indexed += len(chunks)

    vector_store.save()
    return success({"chunks_indexed": indexed, "total_vectors": vector_store.total_vectors},
                   message=f"Indexed {indexed} chunks from across {len(datasets)} synthetic datasets")
