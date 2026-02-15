
import asyncio
from sqlalchemy import text
from database.connection import async_session

async def check():
    async with async_session() as session:
        # Get total count
        result = await session.execute(text("SELECT COUNT(*) FROM claims"))
        count = result.scalar()
        print(f"Total Claims: {count}")

        # Get sample claims
        result = await session.execute(text("""
            SELECT c.claim_number, c.claim_amount, c.claim_type, c.status, p.policyholder_name 
            FROM claims c
            JOIN policies p ON c.policy_id = p.id
            LIMIT 5
        """))
        rows = result.fetchall()
        print("\nSample Claims:")
        for row in rows:
            print(f"- {row[0]}: ${row[1]:,} ({row[2]}) - {row[3]} [{row[4]}]")

if __name__ == "__main__":
    asyncio.run(check())
