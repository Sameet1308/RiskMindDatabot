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
        ChatSession, ChatMessage, Document,
        ZoneThreshold, ZoneAccumulation, DataSource
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

        # Ensure documents linking columns exist (policy_number, claim_number, session_id)
        for col_name, col_type in [("policy_number", "VARCHAR(50)"), ("claim_number", "VARCHAR(50)"), ("session_id", "INTEGER")]:
            result = await conn.execute(
                text(f"SELECT name FROM pragma_table_info('documents') WHERE name='{col_name}'")
            )
            if result.fetchone() is None:
                await conn.execute(text(f"ALTER TABLE documents ADD COLUMN {col_name} {col_type}"))
                await conn.execute(text(f"CREATE INDEX IF NOT EXISTS ix_documents_{col_name} ON documents ({col_name})"))

        # Ensure policies.policy_status exists (active/expired/cancelled)
        result = await conn.execute(
            text("SELECT name FROM pragma_table_info('policies') WHERE name='policy_status'")
        )
        if result.fetchone() is None:
            await conn.execute(text("ALTER TABLE policies ADD COLUMN policy_status VARCHAR(20) DEFAULT 'active'"))
            # Auto-compute status for existing rows based on expiration_date
            await conn.execute(text("""
                UPDATE policies SET policy_status = CASE
                    WHEN expiration_date IS NOT NULL AND expiration_date < date('now') THEN 'expired'
                    ELSE 'active'
                END
                WHERE policy_status IS NULL OR policy_status = 'active'
            """))

async def get_db():
    """Dependency for getting database session"""
    async with async_session() as session:
        yield session
