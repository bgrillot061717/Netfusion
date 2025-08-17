import os, time
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from .db import EXPORT_DIR

router = APIRouter(prefix="/api/map", tags=["map"])

ALLOWED = {"image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg"}

def _map_path():
    # choose whichever exists
    for ext in ("png","jpg","jpeg"):
        p = os.path.join(EXPORT_DIR, f"map.{ext}")
        if os.path.exists(p):
            return p
    return None

@router.get("")
def map_status():
    p = _map_path()
    if not p:
        return {"exists": False}
    ts = int(os.path.getmtime(p))
    return {"exists": True, "url": f"/api/map/image?v={ts}", "updated": ts}

@router.get("/image")
def map_image():
    p = _map_path()
    if not p:
        raise HTTPException(404, "No map")
    return FileResponse(p)

@router.post("")
async def upload_map(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(400, "Only PNG or JPG allowed")
    os.makedirs(EXPORT_DIR, exist_ok=True)
    ext = ALLOWED[file.content_type]
    # remove any prior file
    for e in ("png","jpg","jpeg"):
        old = os.path.join(EXPORT_DIR, f"map.{e}")
        if os.path.exists(old):
            try: os.remove(old)
            except: pass
    path = os.path.join(EXPORT_DIR, f"map.{ext}")
    # stream write
    with open(path, "wb") as f:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk: break
            f.write(chunk)
    return {"ok": True}

@router.delete("")
def delete_map():
    p = _map_path()
    if not p:
        return {"ok": True}
    try:
        os.remove(p)
    except:
        raise HTTPException(500, "Failed to delete map")
    return {"ok": True}
