from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from .db import connect
from .auth import require_min_role

router = APIRouter(prefix="/api/users", tags=["users"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALLOWED_ROLES = {"owner","admin","user","read_only"}

class CreateUserIn(BaseModel):
    email: EmailStr
    password: str
    role: str

def _row_to_dict(r):
    return {"email": r["email"], "role": r["role"]}

@router.get("")
def list_users(user = Depends(require_min_role("admin"))):
    con = connect()
    rows = con.execute("SELECT email, role FROM users ORDER BY email").fetchall()
    return {"users": [_row_to_dict(r) for r in rows]}

@router.post("")
def create_user(body: CreateUserIn, user = Depends(require_min_role("admin"))):
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    role = body.role.lower()
    if role not in ALLOWED_ROLES:
        raise HTTPException(400, "Invalid role")
    con = connect()
    exists = con.execute("SELECT 1 FROM users WHERE email=?", (body.email.lower(),)).fetchone()
    if exists:
        raise HTTPException(409, "Email already exists")
    ph = pwd.hash(body.password)
    con.execute("INSERT INTO users(email,role,password_hash) VALUES (?,?,?)",
                (body.email.lower(), role, ph))
    con.commit()
    return {"ok": True}
