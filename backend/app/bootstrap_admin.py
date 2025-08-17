import sqlite3
from passlib.context import CryptContext

# Hardcoded fallback credentials (simple, reliable recovery)
DEFAULT_EMAIL = "admin@example.com"
DEFAULT_PASS  = "ChangeMeNow1!"
DEFAULT_ROLE  = "owner"
DB_PATH = "/data/netfusion.db"   # SQLite path inside the backend container

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def ensure_admin():
    con = sqlite3.connect(DB_PATH)
    con.execute("""
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      role TEXT,
      password_hash TEXT
    );
    """)
    row = con.execute(
        "SELECT id FROM users WHERE lower(email)=?",
        (DEFAULT_EMAIL.lower(),)
    ).fetchone()
    if row is None:
        ph = pwd.hash(DEFAULT_PASS)
        con.execute(
            "INSERT INTO users(email,role,password_hash) VALUES (?,?,?)",
            (DEFAULT_EMAIL.lower(), DEFAULT_ROLE, ph)
        )
        con.commit()
        print("[bootstrap_admin] Created default admin:", DEFAULT_EMAIL)
    else:
        print("[bootstrap_admin] Admin exists; no change.")
    con.close()
