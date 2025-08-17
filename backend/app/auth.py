import os, time
from typing import Optional
from fastapi import APIRouter, HTTPException, Response, Request, Cookie, Depends
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
from .db import connect, has_any_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.getenv("AUTH_JWT_SECRET", "dev-insecure-change-me")
JWT_EXP_MIN = int(os.getenv("AUTH_JWT_EXP_MIN", "10080"))  # 7 days
COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "nf_session")
RESET_TOKEN = os.getenv("AUTH_RESET_TOKEN", "dev-reset")   # <<< simple shared token

ROLE_ORDER = ["read_only","user","admin","owner"]

class FirstRunCreate(BaseModel):
    email: EmailStr
    password: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ResetIn(BaseModel):
    email: EmailStr
    new_password: str
    token: str

def _issue_jwt(email: str, role: str):
    now = int(time.time())
    return jwt.encode(
        {"sub": email, "email": email, "role": role, "iat": now, "exp": now + JWT_EXP_MIN*60},
        JWT_SECRET, algorithm="HS256"
    )

def _decode(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

def _set_cookie(resp: Response, token: str):
    resp.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax", path="/")

# ---------- auth dependencies ----------
def get_current_user(nf_session: Optional[str] = Cookie(default=None), request: Request = None):
    token = (request.headers.get("Authorization","").removeprefix("Bearer ").strip() or nf_session)
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        claims = _decode(token)
    except JWTError:
        raise HTTPException(401, "Invalid session")
    return {"email": claims.get("email"), "role": claims.get("role")}

def require_min_role(min_role: str):
    def dep(user = Depends(get_current_user)):
        if ROLE_ORDER.index(user["role"]) < ROLE_ORDER.index(min_role):
            raise HTTPException(403, "Forbidden")
        return user
    return dep

# ---------- first-run + login/logout/me ----------
@router.get("/first-run")
def first_run_status():
    return {"needed": not has_any_user()}

@router.post("/first-run")
def first_run_create(body: FirstRunCreate, response: Response):
    if has_any_user():
        raise HTTPException(409, "Admin already exists")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    con = connect()
    ph = pwd.hash(body.password)
    con.execute("INSERT INTO users(email,role,password_hash) VALUES (?,?,?)",
                (body.email.lower(), "owner", ph))
    con.commit()
    token = _issue_jwt(body.email.lower(), "owner")
    _set_cookie(response, token)
    return {"ok": True, "email": body.email.lower(), "role": "owner"}

@router.post("/login")
def login(body: LoginIn, response: Response):
    con = connect()
    u = con.execute("SELECT email,role,password_hash,enabled FROM users WHERE email=?", (body.email.lower(),)).fetchone()
    if (not u) or (u.get('enabled') is not None and int(u['enabled']) == 0) or (not pwd.verify(body.password, u['password_hash'])):
        raise HTTPException(401, "Invalid credentials")
    token = _issue_jwt(u["email"], u["role"])
    _set_cookie(response, token)
    return {"ok": True, "email": u["email"], "role": u["role"]}

@router.get("/me")
def me(user = Depends(get_current_user)):
    return {"email": user["email"], "role": user["role"]}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}

# ---------- simple reset password (temporary, shared token) ----------
@router.post("/reset-password")
def reset_password(body: ResetIn):
    if body.token != RESET_TOKEN:
        raise HTTPException(401, "Invalid reset token")
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    con = connect()
    ph = pwd.hash(body.new_password)
    # update if exists; otherwise create as owner (so you can recover access)
    u = con.execute("SELECT id FROM users WHERE email=?", (body.email.lower(),)).fetchone()
    if u:
        con.execute("UPDATE users SET password_hash=? WHERE id=?", (ph, u["id"]))
        con.commit()
        return {"ok": True, "updated": True}
    else:
        con.execute("INSERT INTO users(email,role,password_hash) VALUES (?,?,?)",
                    (body.email.lower(), "owner", ph))
        con.commit()
        return {"ok": True, "created": True}
