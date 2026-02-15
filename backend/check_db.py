import sqlite3

conn = sqlite3.connect('data/riskmind.db')
tables = [t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Tables:", tables)

for t in tables:
    print(f"\n=== {t} ===")
    for c in conn.execute(f"PRAGMA table_info({t})").fetchall():
        print(f"  {c[1]:25s} {c[2]:15s} {'NOT NULL' if c[3] else 'NULLABLE':10s} DEFAULT={c[4]}")

conn.close()
