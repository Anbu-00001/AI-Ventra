"""WebSocket fan-out for live CCTV analysis events."""
from __future__ import annotations

import json
from datetime import datetime
from fastapi import WebSocket


class VideoAnalysisStreamManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        await self.send(websocket, {"type": "session", "message": "AIVENTRA visual intelligence stream armed"})

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def send(self, websocket: WebSocket, payload: dict) -> None:
        payload = {"timestamp": datetime.utcnow().isoformat() + "Z", **payload}
        await websocket.send_text(json.dumps(payload))

    async def broadcast(self, payload: dict) -> None:
        dead: list[WebSocket] = []
        for websocket in list(self._connections):
            try:
                await self.send(websocket, payload)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(websocket)


video_stream_manager = VideoAnalysisStreamManager()
