from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import sqlite3, time
from .auth import require_min_role, get_current_user
from .db import connect, _has_col

router = APIRouter(prefix="/api/users", tags=["users"])

# --- DB migration for users.enabled + users.created_ts (idempotent) ---
def _migrate_users():
    con = connect()
    # add created_ts if missing
    if not _has_col(con, "users", "created_ts"):
        con.execute("ALTER TABLE users ADD COLUMN created_ts INTEGER NOT NULL DEFAULT (strftime('%s','now'))")
    # add enabled if missing
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

class AdminUpdate(BaseModel):
    role: Optional[str] = None               # owner|admin|user|read_only
    enabled: Optional[bool] = None
    new_password: Optional[str] = None       # only admin/owner can set others' pw

class SelfChangePassword(BaseModel):
    current_password: Optional[str] = None   # optional MVP
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
        rows = con.execute("SELECT id,email,role,enabled,created_ts FROM users ORDER BY id").fetchall()
        return {"users":[_row(dict(r)) for r in rows]}
    # non-admins see only themselves
    r = con.execute("SELECT id,email,role,enabled,created_ts FROM users WHERE email=?", (user["email"].lower(),)).fetchone()
    if not r: raise HTTPException(404, "Not found")
    return {"users":[_row(dict(r))]}

@router.patch("/{user_id}")
def admin_update_user(user_id: int, body: AdminUpdate, admin = Depends(require_min_role("admin"))):
    con = connect()
    r = con.execute("SELECT id,email,role,enabled FROM users WHERE id=?", (user_id,)).fetchone()
    if not r: raise HTTPException(404, "User not found")
    fields = []
    vals = []
    if body.role is not None:
        if body.role not in ROLE_ORDER:
            raise HTTPException(400, "Invalid role")
        fields.append("role=?"); vals.append(body.role)
    if body.enabled is not None:
        fields.append("enabled=?"); vals.append(1 if body.enabled else 0)
    if body.new_password is not None:
        # set below after fields update (uses passlib from auth module)
        pass
    if fields:
        vals.append(user_id)
        con.execute(f"UPDATE users SET {', '.join(fields)} WHERE id=?", vals)
        con.commit()
    if body.new_password is not None:
        # hash via passlib context from auth
        from passlib.context import CryptContext
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        ph = pwd.hash(body.new_password)
        con.execute("UPDATE users SET password_hash=? WHERE id=?", (ph, user_id))
        con.commit()
    return {"ok": True}

@router.post("/change-password")
def self_change_password(body: SelfChangePassword, me = Depends(require_min_role("read_only"))):
    if not body.new_password or len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    con = connect()
    r = con.execute("SELECT id,password_hash FROM users WHERE email=?", (me["email"].lower(),)).fetchone()
    if not r: raise HTTPException(404, "Not found")
    # (optional) verify current password; skip for MVP
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    ph = pwd.hash(body.new_password)
    con.execute("UPDATE users SET password_hash=? WHERE id=?", (ph, r["id"]))
    con.commit()
    return {"ok": True}
