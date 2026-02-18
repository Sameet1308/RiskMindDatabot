"""
Database connection and initialization
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/riskmind.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def init_db():
    """Initialize database tables"""
    # Import all models to ensure they are registered with Base.metadata
    from models.schemas import (
        ClaimRecord, Policy, Guideline, User, Decision, 
        ChatSession, ChatMessage, Document
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Ensure guidelines.policy_number exists for policy-linked guidelines
        result = await conn.execute(
            text("SELECT name FROM pragma_table_info('guidelines') WHERE name='policy_number'")
        )
        if result.fetchone() is None:
            await conn.execute(text("ALTER TABLE guidelines ADD COLUMN policy_number VARCHAR(50)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_guidelines_policy_number ON guidelines (policy_number)"))

        # Ensure policies.assigned_to exists for user-based filtering
        result = await conn.execute(
            text("SELECT name FROM pragma_table_info('policies') WHERE name='assigned_to'")
        )
        if result.fetchone() is None:
            await conn.execute(text("ALTER TABLE policies ADD COLUMN assigned_to VARCHAR(255)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_policies_assigned_to ON policies (assigned_to)"))

async def get_db():
    """Dependency for getting database session"""
    async with async_session() as session:
        yield session
