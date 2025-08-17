import time, uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from .db import connect
from .auth import require_min_role

router = APIRouter(prefix="/api/endpoints", tags=["endpoints"])
KINDS = {"unifi","auvik","generic"}
AUTHS = {"userpass","apikey","token"}

class EndpointIn(BaseModel):
  name: str
  kind: str           # unifi | auvik | generic
  address: str        # URL or IP
  auth_type: str      # userpass | apikey | token
  username: str | None = None
  password: str | None = None
  api_key: str | None = None
  site: str | None = None
  notes: str | None = None

def _row(r):
  return {
    "id": r["id"], "name": r["name"], "kind": r["kind"], "address": r["address"],
    "auth_type": r["auth_type"], "username": r["username"], "site": r["site"],
    "notes": r["notes"], "created_ts": r["created_ts"]
  }

@router.get("")
def list_endpoints(user = Depends(require_min_role("user"))):
  con = connect()
  rows = con.execute("SELECT * FROM endpoints ORDER BY created_ts DESC").fetchall()
  return {"endpoints": [_row(r) for r in rows]}

@router.post("")
def create_endpoint(body: EndpointIn, user = Depends(require_min_role("admin"))):
  if body.kind not in KINDS: raise HTTPException(400, "Invalid kind")
  if body.auth_type not in AUTHS: raise HTTPException(400, "Invalid auth_type")
  if not body.name.strip(): raise HTTPException(400, "Name required")
  if not body.address.strip(): raise HTTPException(400, "Address required")
  eid = uuid.uuid4().hex
  con = connect()
  con.execute("""INSERT INTO endpoints
    (id,name,kind,address,auth_type,username,password,api_key,site,notes,created_ts)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
    (eid, body.name.strip(), body.kind, body.address.strip(), body.auth_type,
     body.username, body.password, body.api_key, body.site, body.notes, int(time.time())))
  con.commit()
  return {"ok": True, "id": eid}

@router.delete("/{endpoint_id}")
def delete_endpoint(endpoint_id: str, user = Depends(require_min_role("admin"))):
  con = connect()
  con.execute("DELETE FROM endpoints WHERE id=?", (endpoint_id,))
  con.commit()
  return {"ok": True}
