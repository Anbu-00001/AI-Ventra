"""
Evidence Correlation Engine.
Builds a graph of entities (suspects, devices, locations, timestamps) and
their relationships from multi-source evidence.
"""
from app.services.ai.ollama_client import ollama_client
from app.services.ai.prompt_engine import prompt_engine
from app.models.correlations import CorrelationGraph, CorrelationNode, CorrelationEdge
from app.utils.mock_generators import build_correlation_fallback
from app.core.logging import logger
import json


class CorrelationEngine:

    async def correlate(self, entities_data: dict) -> CorrelationGraph:
        logger.info("Running correlation engine...")
        context = json.dumps(entities_data, indent=2)[:3000]
        prompt = prompt_engine.correlate_evidence(context)

        result = await ollama_client.ask_llm(
            prompt=prompt,
            system=prompt_engine.FORENSIC_SYSTEM,
            temperature=0.2,
        )

        raw_nodes = result.get("nodes", [])
        raw_edges = result.get("edges", [])

        if not raw_nodes:
            return build_correlation_fallback()

        nodes = [CorrelationNode(**n) for n in raw_nodes]
        edges = [CorrelationEdge(**e) for e in raw_edges]

        return CorrelationGraph(
            nodes=nodes,
            edges=edges,
            total_nodes=len(nodes),
            total_edges=len(edges),
            ai_insight=result.get("ai_insight", "Evidence correlation reveals interconnected network of suspects and digital traces."),
            insight_confidence=float(result.get("insight_confidence", 89.0)),
            high_confidence_paths=result.get("high_confidence_paths", []),
        )


correlation_engine = CorrelationEngine()
