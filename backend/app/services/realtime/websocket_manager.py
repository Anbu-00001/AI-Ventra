"""
WebSocket connection manager.
Broadcasts forensic analysis stage updates to connected frontend clients.
"""
import asyncio
import json
from typing import Any
from fastapi import WebSocket
from app.core.logging import logger


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WebSocket connected — total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)
        logger.info(f"WebSocket disconnected — total: {len(self.active)}")

    async def broadcast(self, message: dict):
        payload = json.dumps(message)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)

    async def send_stage(self, stage: str, progress: int, detail: str = "", ws: WebSocket = None):
        msg = {
            "type": "analysis_stage",
            "stage": stage,
            "progress": progress,
            "detail": detail,
        }
        if ws:
            try:
                await ws.send_text(json.dumps(msg))
            except Exception:
                pass
        else:
            await self.broadcast(msg)


manager = ConnectionManager()
