from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from .auth import get_current_user, require_min_role
from .db import connect, site_ids_for_user

router = APIRouter(prefix="/api/devices", tags=["devices"])

class DeviceRow(BaseModel):
    id: int
    name: Optional[str] = None
    mac: Optional[str] = None
    mgmt_ip: Optional[str] = None
    vendor: Optional[str] = None
    site_id: Optional[int] = None
    last_seen_ts: Optional[int] = None

def _row(r) -> Dict:
    return {
        "id": r["id"], "name": r["name"], "mac": r["mac"],
        "mgmt_ip": r["mgmt_ip"], "vendor": r["vendor"],
        "site_id": r["site_id"], "last_seen_ts": r["last_seen_ts"]
    }

@router.get("")
def list_devices(
    q: Optional[str] = Query(default=None, description="Optional substring filter on name/mac/ip"),
    user = Depends(get_current_user)
):
    con = connect()
    is_admin, allowed = site_ids_for_user(user["email"], user["role"])

    where = []
    params: List = []
    if q:
        where.append("(name LIKE ? OR mac LIKE ? OR mgmt_ip LIKE ?)")
        like = f"%{q}%"
        params += [like, like, like]

    if not is_admin:
        if not allowed:
            return {"devices": []}
        where.append(f"site_id IN ({','.join(['?']*len(allowed))})")
        params += allowed

    sql = "SELECT id,name,mac,mgmt_ip,vendor,site_id,last_seen_ts FROM devices"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY name NULLS LAST, id"

    rows = con.execute(sql, params).fetchall()
    return {"devices": [_row(r) for r in rows]}

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    vendor: Optional[str] = None
    site_id: Optional[int] = None

@router.patch("/{device_id}")
def update_device(device_id: int, body: DeviceUpdate, user = Depends(get_current_user)):
    con = connect()
    # Check the device exists
    r = con.execute("SELECT id, site_id FROM devices WHERE id=?", (device_id,)).fetchone()
    if not r:
        raise HTTPException(404, "Device not found")

    # Permission check:
    is_admin, allowed = site_ids_for_user(user["email"], user["role"])
    if not is_admin:
        # Non-admin may edit only inside their permitted sites (and not move devices out)
        current_site_id = r["site_id"]
        if (current_site_id is None) or (current_site_id not in allowed):
            raise HTTPException(403, "Forbidden")

        # If they try to change site_id, ensure new one is also allowed
        if body.site_id is not None and body.site_id not in allowed:
            raise HTTPException(403, "Cannot move device to a site you don't have access to")

    # Update
    sets = []
    vals = []
    for field in ("name", "vendor", "site_id"):
        val = getattr(body, field)
        if val is not None:
            sets.append(f"{field}=?")
            vals.append(val)
    if not sets:
        return {"ok": True, "updated": 0}
    vals.append(device_id)
    con.execute(f"UPDATE devices SET {', '.join(sets)} WHERE id=?", vals)
    con.commit()
    return {"ok": True, "updated": 1}
