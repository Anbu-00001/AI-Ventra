"""
WebSocket endpoint for real-time analysis progress updates.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.realtime.websocket_manager import manager
from app.core.constants import ANALYSIS_STAGES
from app.core.logging import logger
import json
import asyncio

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{case_id}")
async def websocket_endpoint(websocket: WebSocket, case_id: str):
    await manager.connect(websocket)
    try:
        # Send initial connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connected",
            "case_id": case_id,
            "message": "AIVENTRA intelligence stream active",
        }))

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            # Echo acknowledgement
            await websocket.send_text(json.dumps({
                "type": "ack",
                "received": msg,
            }))

            if msg.get("action") in {"start", "start_analysis", "run"}:
                for index, stage in enumerate(ANALYSIS_STAGES, start=1):
                    await manager.send_stage(
                        stage=stage,
                        progress=round(index / len(ANALYSIS_STAGES) * 100),
                        detail=f"{stage.title()} complete for case {case_id}",
                        ws=websocket,
                    )
                    await asyncio.sleep(0.35)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket disconnected: case {case_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
