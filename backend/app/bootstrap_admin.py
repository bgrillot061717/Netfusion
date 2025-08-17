import sqlite3, time
from passlib.context import CryptContext

# Hardcoded fallback credentials (recovery)
DEFAULT_EMAIL = "admin@example.com"
DEFAULT_PASS  = "ChangeMeNow1!"
DEFAULT_ROLE  = "owner"
DB_PATH = "/data/netfusion.db"   # SQLite path inside the backend container

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _has_col(con, table, col):
    rows = con.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r[1] == col for r in rows)

def ensure_admin():
    con = sqlite3.connect(DB_PATH)
    # minimal table (older deploys); some newer deploys added created_ts NOT NULL
    con.execute("""
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      role TEXT,
      password_hash TEXT
    );
    """)

    # If created_ts is missing, add it with a default so inserts won’t fail
    if not _has_col(con, "users", "created_ts"):
        con.execute("ALTER TABLE users ADD COLUMN created_ts INTEGER NOT NULL DEFAULT (strftime('%s','now'))")
        con.commit()

    row = con.execute(
        "SELECT id FROM users WHERE lower(email)=?",
        (DEFAULT_EMAIL.lower(),)
    ).fetchone()

    now = int(time.time())
    if row is None:
        ph = pwd.hash(DEFAULT_PASS)
        # include created_ts explicitly (covers both old/new schemas)
        con.execute(
            "INSERT INTO users(email, role, password_hash, created_ts) VALUES (?, ?, ?, ?)",
            (DEFAULT_EMAIL.lower(), DEFAULT_ROLE, ph, now)
        )
        con.commit()
        print("[bootstrap_admin] Created default admin:", DEFAULT_EMAIL)
    else:
        print("[bootstrap_admin] Admin exists; no change.")
    con.close()
