import os, sqlite3, time, pathlib
# --- add/ensure at top of db.py ---
import sqlite3, time, os
DB_PATH = os.getenv("DB_PATH", "/data/netfusion.db")
def site_ids_for_user(email: str, role: str):
    """
    Returns a tuple (is_admin, site_ids)
    - is_admin: True if role is owner/admin (no restriction)
    - site_ids: list of ints the user can access (only meaningful if is_admin is False)
    """
    if role in ("owner", "admin"):
        return True, []
    con = connect()
    rows = con.execute("""
        SELECT s.id
        FROM sites s
        JOIN user_site_access usa ON usa.site_id = s.id
        JOIN users u ON u.id = usa.user_id
        WHERE lower(u.email) = ?
    """, (email.lower(),)).fetchall()
    return False, [int(r["id"]) for r in rows]

def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def _has_col(conn, table, col):
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    # row[1] is the column name in default row format
    return any((r[1] if isinstance(r, tuple) else r["name"]) == col for r in rows)

def migrate_core():
    con = connect()
    # users
    con.execute("""
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      role TEXT,
      password_hash TEXT
    )
    """)
    if not _has_col(con, "users", "created_ts"):
        con.execute("ALTER TABLE users ADD COLUMN created_ts INTEGER NOT NULL DEFAULT (strftime('%s','now'))")
    if not _has_col(con, "users", "enabled"):
        con.execute("ALTER TABLE users ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1")

    # sites
    con.execute("""
    CREATE TABLE IF NOT EXISTS sites(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      slug TEXT UNIQUE,
      created_ts INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
    """)

    # devices (collector-normalized view)
    con.execute("""
    CREATE TABLE IF NOT EXISTS devices(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      mac TEXT UNIQUE,
      mgmt_ip TEXT,
      vendor TEXT,
      site_id INTEGER,
      last_seen_ts INTEGER,
      FOREIGN KEY(site_id) REFERENCES sites(id)
    )
    """)

    # physical links (undirected edges)
    con.execute("""
    CREATE TABLE IF NOT EXISTS device_links(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      a_id INTEGER NOT NULL,
      b_id INTEGER NOT NULL,
      last_seen_ts INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(a_id, b_id)
    )
    """)

    # who can view which site
    con.execute("""
    CREATE TABLE IF NOT EXISTS user_site_access(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      site_id INTEGER NOT NULL,
      can_edit INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, site_id)
    )
    """)

    con.commit()
    con.close()

EXPORT_DIR = os.getenv("EXPORT_DIR", "/data")
DB_PATH = os.path.join(EXPORT_DIR, "netfusion.db")
MAP_DIR = os.path.join(EXPORT_DIR, "maps")

DDL_USERS = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
"""

DDL_MAPS = """
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_ts INTEGER NOT NULL
);
"""

DDL_SETTINGS = """
CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
"""

DDL_ENDPOINTS = """
CREATE TABLE IF NOT EXISTS endpoints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,          -- unifi | auvik | generic
  address TEXT NOT NULL,       -- base url or host/ip
  auth_type TEXT NOT NULL,     -- userpass | apikey | token (MVP)
  username TEXT,
  password TEXT,
  api_key TEXT,
  site TEXT,
  notes TEXT,
  created_ts INTEGER NOT NULL
);
"""

def connect():
  os.makedirs(EXPORT_DIR, exist_ok=True)
  os.makedirs(MAP_DIR, exist_ok=True)
  conn = sqlite3.connect(DB_PATH, check_same_thread=False)
  conn.row_factory = sqlite3.Row
  for ddl in (DDL_USERS, DDL_MAPS, DDL_SETTINGS, DDL_ENDPOINTS):
    conn.executescript(ddl)
  conn.commit()
  _migrate(conn)
  return conn

def _has_col(conn, table, col):
  rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
  return any(r["name"] == col for r in rows)

def _migrate(conn):
  # add 'enabled'
  if not _has_col(conn, "endpoints", "enabled"):
    conn.execute("ALTER TABLE endpoints ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1")
  # add SNMP fields
  if not _has_col(conn, "endpoints", "snmp_version"):
    conn.execute("ALTER TABLE endpoints ADD COLUMN snmp_version TEXT")
  if not _has_col(conn, "endpoints", "snmp_community"):
    conn.execute("ALTER TABLE endpoints ADD COLUMN snmp_community TEXT")
  conn.commit()

def has_any_user() -> bool:
  c = connect()
  return c.execute("SELECT 1 FROM users LIMIT 1").fetchone() is not None

def map_image_path(map_id: str, ext: str|None=None) -> str:
  os.makedirs(MAP_DIR, exist_ok=True)
  if ext:
    return os.path.join(MAP_DIR, f"{map_id}.{ext}")
  for e in ("png","jpg","jpeg"):
    p = os.path.join(MAP_DIR, f"{map_id}.{e}")
    if os.path.exists(p): return p
  return ""

def get_setting(conn, key: str) -> str|None:
  r = conn.execute("SELECT v FROM settings WHERE k=?", (key,)).fetchone()
  return r["v"] if r else None

def set_setting(conn, key: str, val: str):
  conn.execute("INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (key, val))
  conn.commit()
