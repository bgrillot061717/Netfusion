from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import sqlite3, time
from passlib.context import CryptContext
from .auth import require_min_role, get_current_user
from .db import connect, _has_col

router = APIRouter(prefix="/api/users", tags=["users"])

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- DB migration for users.enabled + users.created_ts (idempotent) ---
def _migrate_users():
    con = connect()
    if not _has_col(con, "users", "created_ts"):
        con.execute("ALTER TABLE users ADD COLUMN created_ts INTEGER NOT NULL DEFAULT (strftime('%s','now'))")
    if not _has_col(con, "users", "enabled"):
        con.execute("ALTER TABLE users ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1")
    con.commit()
_migrate_users()

# --- Schemas ---
class UserRow(BaseModel):
    id: int
    email: EmailStr
    role: str
    enabled: bool
    created_ts: int

class AdminCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"           # owner|admin|user|read_only
    enabled: bool = True

class AdminUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    enabled: Optional[bool] = None
    new_password: Optional[str] = None

class SelfChangePassword(BaseModel):
    new_password: str

ROLE_ORDER = ["read_only","user","admin","owner"]

def _row(r):
    return {
        "id": r["id"],
        "email": r["email"],
        "role": r["role"],
        "enabled": bool(r["enabled"]) if "enabled" in r.keys() else True,
        "created_ts": r.get("created_ts", int(time.time()))
    }

# --- Routes ---
@router.get("")
def list_users(user = Depends(get_current_user)):
    con = connect()
    if user["role"] in ("owner","admin"):
        rows = con.execute("SELECT id,email,role,enabled,created_ts FROM users ORDER BY email").fetchall()
        return {"users":[_row(dict(r)) for r in rows]}
    r = con.execute("SELECT id,email,role,enabled,created_ts FROM users WHERE lower(email)=?", (user["email"].lower(),)).fetchone()
    if not r: raise HTTPException(404, "Not found")
    return {"users":[_row(dict(r))]}

@router.post("")
def admin_create_user(body: AdminCreate, admin = Depends(require_min_role("admin"))):
    if body.role not in ROLE_ORDER:
        raise HTTPException(400, "Invalid role")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    con = connect()
    ph = pwd_ctx.hash(body.password)
    try:
        con.execute(
            "INSERT INTO users(email,role,password_hash,enabled,created_ts) VALUES (?,?,?,?,strftime('%s','now'))",
            (body.email.lower(), body.role, ph, 1 if body.enabled else 0)
        )
        con.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Email already exists")
    u = con.execute("SELECT id,email,role,enabled,created_ts FROM users WHERE lower(email)=?", (body.email.lower(),)).fetchone()
    return _row(dict(u))

@router.patch("/{user_id}")
def admin_update_user(user_id: int, body: AdminUpdate, admin = Depends(require_min_role("admin"))):
    con = connect()
    r = con.execute("SELECT id,email,role,enabled FROM users WHERE id=?", (user_id,)).fetchone()
    if not r: raise HTTPException(404, "User not found")

    sets = []
    vals = []

    if body.email is not None:
        sets.append("email=?"); vals.append(body.email.lower())
    if body.role is not None:
        if body.role not in ROLE_ORDER:
            raise HTTPException(400, "Invalid role")
        sets.append("role=?"); vals.append(body.role)
    if body.enabled is not None:
        sets.append("enabled=?"); vals.append(1 if body.enabled else 0)

    if sets:
        try:
            vals.append(user_id)
            con.execute(f"UPDATE users SET {', '.join(sets)} WHERE id=?", vals)
            con.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Email already exists")

    if body.new_password is not None:
        if len(body.new_password) < 8:
            raise HTTPException(400, "Password must be at least 8 characters")
        ph = pwd_ctx.hash(body.new_password)
        con.execute("UPDATE users SET password_hash=? WHERE id=?", (ph, user_id))
        con.commit()

    return {"ok": True}

@router.post("/change-password")
def self_change_password(body: SelfChangePassword, me = Depends(get_current_user)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    con = connect()
    r = con.execute("SELECT id FROM users WHERE email=?", (me["email"].lower(),)).fetchone()
    if not r: raise HTTPException(404, "Not found")
    ph = pwd_ctx.hash(body.new_password)
    con.execute("UPDATE users SET password_hash=? WHERE id=?", (ph, r["id"]))
    con.commit()
    return {"ok": True}
