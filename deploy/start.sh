#!/bin/bash
set -e

echo "=== RiskMind Startup ==="

# Ensure data directories exist (persistent disk mount)
mkdir -p /app/data/uploads /app/data/chroma_db

# Seed database if empty (first deploy)
if [ ! -f /app/data/riskmind.db ]; then
    echo "[SEED] No database found — seeding initial data..."
    python seed_data.py
    echo "[SEED] Database seeded successfully"
else
    echo "[DB] Existing database found at /app/data/riskmind.db"
fi

echo "[START] Launching RiskMind on port ${PORT:-10000}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-10000}"
