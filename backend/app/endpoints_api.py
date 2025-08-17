import time, uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from .db import connect
from .auth import require_min_role

router = APIRouter(prefix="/api/endpoints", tags=["endpoints"])
KINDS = {"unifi","auvik","generic"}
AUTHS = {"userpass","apikey","token"}

class EndpointIn(BaseModel):
  name: str
  kind: str
  address: str
  auth_type: str
  username: Optional[str] = None
  password: Optional[str] = None
  api_key: Optional[str] = None
  site: Optional[str] = None
  notes: Optional[str] = None
  enabled: Optional[bool] = True
  snmp_version: Optional[str] = None   # e.g., "2c"
  snmp_community: Optional[str] = None # v2c community

class EndpointUpdate(BaseModel):
  name: Optional[str] = None
  kind: Optional[str] = None
  address: Optional[str] = None
  auth_type: Optional[str] = None
  username: Optional[str] = None
  password: Optional[str] = None
  api_key: Optional[str] = None
  site: Optional[str] = None
  notes: Optional[str] = None
  enabled: Optional[bool] = None
  snmp_version: Optional[str] = None
  snmp_community: Optional[str] = None

def _row(r):
  return {
    "id": r["id"], "name": r["name"], "kind": r["kind"], "address": r["address"],
    "auth_type": r["auth_type"], "username": r["username"], "site": r["site"],
    "notes": r["notes"], "created_ts": r["created_ts"], "enabled": bool(r["enabled"]),
    "snmp_version": r["snmp_version"], "snmp_community": r["snmp_community"],
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
  if not body.name or not body.name.strip(): raise HTTPException(400, "Name required")
  if not body.address or not body.address.strip(): raise HTTPException(400, "Address required")
  eid = uuid.uuid4().hex
  con = connect()
  con.execute("""INSERT INTO endpoints
    (id,name,kind,address,auth_type,username,password,api_key,site,notes,created_ts,enabled,snmp_version,snmp_community)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
    (eid, body.name.strip(), body.kind, body.address.strip(), body.auth_type,
     body.username, body.password, body.api_key, body.site, body.notes,
     int(time.time()), int(bool(body.enabled)), body.snmp_version, body.snmp_community))
  con.commit()
  return {"ok": True, "id": eid}

@router.patch("/{endpoint_id}")
def update_endpoint(endpoint_id: str, body: EndpointUpdate, user = Depends(require_min_role("admin"))):
  con = connect()
  r = con.execute("SELECT * FROM endpoints WHERE id=?", (endpoint_id,)).fetchone()
  if not r: raise HTTPException(404, "Not found")
  fields = []
  vals = []
  for k, v in body.model_dump(exclude_unset=True).items():
    if k == "kind" and v and v not in KINDS: raise HTTPException(400, "Invalid kind")
    if k == "auth_type" and v and v not in AUTHS: raise HTTPException(400, "Invalid auth_type")
    fields.append(f"{k}=?")
    if k == "enabled": vals.append(int(bool(v)))
    else: vals.append(v)
  if not fields:
    return {"ok": True}
  vals.append(endpoint_id)
  con.execute(f"UPDATE endpoints SET {', '.join(fields)} WHERE id=?", vals)
  con.commit()
  return {"ok": True}

@router.patch("/{endpoint_id}/toggle")
def toggle_endpoint(endpoint_id: str, body: dict, user = Depends(require_min_role("admin"))):
  enabled = body.get("enabled")
  if enabled is None: raise HTTPException(400, "enabled required")
  con = connect()
  con.execute("UPDATE endpoints SET enabled=? WHERE id=?", (int(bool(enabled)), endpoint_id))
  con.commit()
  return {"ok": True}

@router.delete("/{endpoint_id}")
def delete_endpoint(endpoint_id: str, user = Depends(require_min_role("admin"))):
  con = connect()
  con.execute("DELETE FROM endpoints WHERE id=?", (endpoint_id,))
  con.commit()
  return {"ok": True}
