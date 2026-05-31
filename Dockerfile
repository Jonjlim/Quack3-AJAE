FROM python:3.11-slim-bookworm

WORKDIR /app

# OpenCV + MediaPipe runtime libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/triage-engine/requirements.txt backend/triage-engine/requirements.txt
COPY backend/rppg/requirements.txt backend/rppg/requirements.txt

RUN pip install --no-cache-dir -r backend/triage-engine/requirements.txt

COPY shared/ shared/
COPY backend/triage-engine/ backend/triage-engine/
COPY backend/rppg/ backend/rppg/

ENV PYTHONPATH=/app:/app/backend/rppg

WORKDIR /app/backend/triage-engine

RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
