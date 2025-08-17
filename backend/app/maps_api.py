import os, time, uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from .db import connect, map_image_path, MAP_DIR, get_setting, set_setting
from .auth import require_min_role

router = APIRouter(prefix="/api/maps", tags=["maps"])
ALLOWED = {"image/png":"png", "image/jpeg":"jpg", "image/jpg":"jpg"}

class CreateMapIn(BaseModel):
  name: str

def _map_row(r):
  return {"id": r["id"], "name": r["name"], "created_ts": r["created_ts"]}

@router.get("")
def list_maps(user = Depends(require_min_role("user"))):
  con = connect()
  rows = con.execute("SELECT id,name,created_ts FROM maps ORDER BY created_ts DESC").fetchall()
  active = get_setting(con, "active_map_id")
  return {"maps": [_map_row(r) for r in rows], "active_id": active}

@router.post("")
def create_map(body: CreateMapIn, user = Depends(require_min_role("admin"))):
  name = body.name.strip()
  if not name:
    raise HTTPException(400, "Name required")
  con = connect()
  mid = uuid.uuid4().hex
  con.execute("INSERT INTO maps(id,name,created_ts) VALUES (?,?,?)", (mid, name, int(time.time())))
  con.commit()
  # if no active map yet, set this one active
  if not get_setting(con, "active_map_id"):
    set_setting(con, "active_map_id", mid)
  return {"ok": True, "id": mid}

@router.get("/active")
def get_active(user = Depends(require_min_role("user"))):
  con = connect()
  active = get_setting(con, "active_map_id")
  if not active:
    return {"id": None, "url": None}
  path = map_image_path(active)
  v = int(os.path.getmtime(path)) if path and os.path.exists(path) else 0
  return {"id": active, "url": f"/api/maps/{active}/image?v={v}" if v else None}

@router.patch("/active")
def set_active(body: dict, user = Depends(require_min_role("admin"))):
  mid = body.get("id")
  if not mid:
    raise HTTPException(400, "id required")
  con = connect()
  r = con.execute("SELECT 1 FROM maps WHERE id=?", (mid,)).fetchone()
  if not r:
    raise HTTPException(404, "Map not found")
  set_setting(con, "active_map_id", mid)
  return {"ok": True}

@router.post("/{map_id}/image")
async def upload_map_image(map_id: str, file: UploadFile = File(...), user = Depends(require_min_role("admin"))):
  if file.content_type not in ALLOWED:
    raise HTTPException(400, "Only PNG or JPG allowed")
  con = connect()
  r = con.execute("SELECT 1 FROM maps WHERE id=?", (map_id,)).fetchone()
  if not r:
    raise HTTPException(404, "Map not found")
  # remove any prior image for this map
  for e in ("png","jpg","jpeg"):
    p = map_image_path(map_id, e)
    if os.path.exists(p):
      try: os.remove(p)
      except: pass
  ext = ALLOWED[file.content_type]
  dest = map_image_path(map_id, ext)
  os.makedirs(os.path.dirname(dest), exist_ok=True)
  with open(dest, "wb") as f:
    while True:
      chunk = await file.read(1024*1024)
      if not chunk: break
      f.write(chunk)
  return {"ok": True}

@router.get("/{map_id}/image")
def get_map_image(map_id: str, user = Depends(require_min_role("user"))):
  p = map_image_path(map_id)
  if not p or not os.path.exists(p):
    raise HTTPException(404, "No image for this map")
  return FileResponse(p)

@router.delete("/{map_id}")
def delete_map(map_id: str, user = Depends(require_min_role("admin"))):
  con = connect()
  con.execute("DELETE FROM maps WHERE id=?", (map_id,))
  con.commit()
  # delete files
  for e in ("png","jpg","jpeg"):
    p = map_image_path(map_id, e)
    if p and os.path.exists(p):
      try: os.remove(p)
      except: pass
  # clear active if it was this one
  active = get_setting(con, "active_map_id")
  if active == map_id:
    set_setting(con, "active_map_id", "")
  return {"ok": True}
