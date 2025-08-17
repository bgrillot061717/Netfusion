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

# Add a quick exists check endpoint
@router.get("/exists/{email}")
def check_user_exists(email: EmailStr, admin=Depends(require_min_role("admin"))):
    con = connect()
    r = con.execute("SELECT id FROM users WHERE lower(email)=?", (email.lower(),)).fetchone()
    return {"exists": bool(r)}


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
def create_user(body: UserCreate, admin=Depends(require_min_role("admin"))):
    con = connect()
    existing = con.execute("SELECT id FROM users WHERE lower(email)=?", (body.email.lower(),)).fetchone()
    if existing:
        raise HTTPException(409, "User with this email already exists")
    con.execute("INSERT INTO users (email,password,role,enabled) VALUES (?,?,?,?)",
                (body.email.lower(), hash_password(body.password), body.role, body.enabled))
    con.commit()
    return {"status":"ok"}

@router.patch("/by-email/{email}")
def update_user_by_email(email: EmailStr, body: AdminUpdate, admin=Depends(require_min_role("admin"))):
    con = connect()
    r = con.execute("SELECT * FROM users WHERE lower(email)=?", (email.lower(),)).fetchone()
    if not r:
        raise HTTPException(404, "User not found")

    fields, values = [], []
    if body.new_password:
        fields.append("password=?")
        values.append(hash_password(body.new_password))
    if body.role:
        fields.append("role=?")
        values.append(body.role)
    if body.enabled is not None:
        fields.append("enabled=?")
        values.append(1 if body.enabled else 0)

    if fields:
        q = f"UPDATE users SET {', '.join(fields)} WHERE id=?"
        con.execute(q, (*values, r["id"]))
        con.commit()

    return {"status":"ok"}
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
