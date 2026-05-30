import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket
from shared.schemas.telemetry import TelemetryEnvelope, TelemetryEventType


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, group: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[group].append(websocket)

    def disconnect(self, group: str, websocket: WebSocket) -> None:
        if websocket in self._connections[group]:
            self._connections[group].remove(websocket)

    async def broadcast(
        self,
        group: str,
        event_type: TelemetryEventType,
        payload: dict[str, Any],
    ) -> None:
        envelope = TelemetryEnvelope(
            type=event_type,
            timestamp=datetime.now(timezone.utc),
            payload=payload,
        )
        message = envelope.model_dump_json()
        dead: list[WebSocket] = []
        for connection in self._connections[group]:
            try:
                await connection.send_text(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(group, connection)

    async def send_json(self, websocket: WebSocket, data: dict[str, Any]) -> None:
        await websocket.send_text(json.dumps(data))


manager = ConnectionManager()
