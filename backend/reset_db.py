
import asyncio
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.connection import engine, Base
from models.schemas import ClaimRecord, Policy, Guideline, User, Decision, ChatSession, ChatMessage, Document

async def reset_database():
    print("🗑️  Dropping all tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables recreated successfully.")

if __name__ == "__main__":
    asyncio.run(reset_database())
