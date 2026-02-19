# ── Stage 1: Build React frontend ──
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + serve frontend ──
FROM python:3.11-slim

# System deps for ChromaDB / SQLite
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend into /app/static
COPY --from=frontend-build /app/frontend/dist ./static

# Create data directory (will be overridden by persistent disk mount)
RUN mkdir -p /app/data /app/data/uploads /app/data/chroma_db

# Copy startup script
COPY deploy/start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 10000

CMD ["./start.sh"]
