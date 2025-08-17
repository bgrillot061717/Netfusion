import os, sqlite3
EXPORT_DIR = os.getenv("EXPORT_DIR", "/data")
DB_PATH = os.path.join(EXPORT_DIR, "netfusion.db")

DDL = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
"""

def connect():
  os.makedirs(EXPORT_DIR, exist_ok=True)
  conn = sqlite3.connect(DB_PATH, check_same_thread=False)
  conn.row_factory = sqlite3.Row
  conn.executescript(DDL)
  conn.commit()
  return conn

def has_any_user() -> bool:
  c = connect()
  return c.execute("SELECT 1 FROM users LIMIT 1").fetchone() is not None
