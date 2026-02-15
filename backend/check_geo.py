
import asyncio
from sqlalchemy import text
from database.connection import async_session

async def check():
    async with async_session() as session:
        result = await session.execute(text("SELECT policy_number, latitude, longitude FROM policies ORDER BY policy_number LIMIT 5"))
        rows = result.fetchall()
        print("Policy | Lat | Lon")
        for row in rows:
            print(f"{row[0]} | {row[1]} | {row[2]}")

if __name__ == "__main__":
    asyncio.run(check())
