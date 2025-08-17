from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Set
import re, time
from .auth import require_min_role, get_current_user
from .db import connect, migrate_core

router = APIRouter(prefix="/api/sites", tags=["sites"])

migrate_core()

def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "site"

class SiteIn(BaseModel):
    name: str

class GrantIn(BaseModel):
    email: str
    can_edit: bool = False

class AssignDevicesIn(BaseModel):
    device_ids: List[int]

class SiteRow(BaseModel):
    id: int
    name: str
    slug: str
    created_ts: int

def _site_row(r) -> Dict:
    return {"id": r["id"], "name": r["name"], "slug": r["slug"], "created_ts": r["created_ts"]}

@router.get("")
def list_sites(user = Depends(get_current_user)):
    con = connect()
    if user["role"] in ("owner","admin"):
        rows = con.execute("SELECT id,name,slug,created_ts FROM sites ORDER BY name").fetchall()
    else:
        # restricted: only sites user has access to
        rows = con.execute("""
          SELECT s.id,s.name,s.slug,s.created_ts
          FROM sites s
          JOIN user_site_access usa ON usa.site_id=s.id
          JOIN users u ON u.id=usa.user_id
          WHERE lower(u.email)=?
          ORDER BY s.name
        """, (user["email"].lower(),)).fetchall()
    return {"sites":[_site_row(dict(r)) for r in rows]}

@router.post("")
def create_site(body: SiteIn, admin = Depends(require_min_role("admin"))):
    con = connect()
    slug = slugify(body.name)
    # ensure unique slug
    base = slug
    n = 1
    while con.execute("SELECT 1 FROM sites WHERE slug=?", (slug,)).fetchone():
        n += 1
        slug = f"{base}-{n}"
    con.execute("INSERT INTO sites(name, slug) VALUES (?,?)", (body.name, slug))
    con.commit()
    s = con.execute("SELECT id,name,slug,created_ts FROM sites WHERE slug=?", (slug,)).fetchone()
    return _site_row(dict(s))

@router.patch("/{site_id}")
def rename_site(site_id: int, body: SiteIn, admin = Depends(require_min_role("admin"))):
    con = connect()
    r = con.execute("SELECT id FROM sites WHERE id=?", (site_id,)).fetchone()
    if not r: raise HTTPException(404, "Site not found")
    con.execute("UPDATE sites SET name=? WHERE id=?", (body.name, site_id))
    con.commit()
    s = con.execute("SELECT id,name,slug,created_ts FROM sites WHERE id=?", (site_id,)).fetchone()
    return _site_row(dict(s))

@router.post("/{site_id}/grant")
def grant_site(site_id: int, body: GrantIn, admin = Depends(require_min_role("admin"))):
    con = connect()
    s = con.execute("SELECT id FROM sites WHERE id=?", (site_id,)).fetchone()
    if not s: raise HTTPException(404, "Site not found")
    u = con.execute("SELECT id FROM users WHERE lower(email)=?", (body.email.lower(),)).fetchone()
    if not u: raise HTTPException(404, "User not found")
    con.execute("""
      INSERT INTO user_site_access(user_id, site_id, can_edit)
      VALUES (?,?,?)
      ON CONFLICT(user_id, site_id) DO UPDATE SET can_edit=excluded.can_edit
    """, (u["id"], site_id, 1 if body.can_edit else 0))
    con.commit()
    return {"ok": True}

@router.get("/{site_id}/users")
def list_site_users(site_id: int, admin = Depends(require_min_role("admin"))):
    con = connect()
    rows = con.execute("""
      SELECT u.id, u.email, u.role, usa.can_edit
      FROM user_site_access usa
      JOIN users u ON u.id = usa.user_id
      WHERE usa.site_id=?
      ORDER BY u.email
    """, (site_id,)).fetchall()
    return {"users":[{"id":r["id"],"email":r["email"],"role":r["role"],"can_edit":bool(r["can_edit"])} for r in rows]}

@router.post("/{site_id}/assign-devices")
def assign_devices(site_id: int, body: AssignDevicesIn, admin = Depends(require_min_role("admin"))):
    con = connect()
    s = con.execute("SELECT id FROM sites WHERE id=?", (site_id,)).fetchone()
    if not s: raise HTTPException(404, "Site not found")
    if not body.device_ids:
        return {"updated": 0}
    qmarks = ",".join(["?"]*len(body.device_ids))
    con.execute(f"UPDATE devices SET site_id=? WHERE id IN ({qmarks})", (site_id, *body.device_ids))
    con.commit()
    return {"updated": len(body.device_ids)}

# ---------- Auto-assign ----------
# Rule: any unassigned device physically connected (via one or more hops)
# to a device already assigned to this site gets assigned to this site.
@router.post("/{site_id}/auto-assign")
def auto_assign(site_id: int, admin = Depends(require_min_role("admin"))):
    con = connect()
    s = con.execute("SELECT id FROM sites WHERE id=?", (site_id,)).fetchone()
    if not s: raise HTTPException(404, "Site not found")

    # Build adjacency from device_links
    edges = con.execute("SELECT a_id,b_id FROM device_links").fetchall()
    adj: Dict[int, Set[int]] = {}
    def add_edge(a,b):
        adj.setdefault(a,set()).add(b)
        adj.setdefault(b,set()).add(a)
    for e in edges:
        a,b = int(e["a_id"]), int(e["b_id"])
        if a != b:
            add_edge(a,b)

    # Find seed devices already on this site
    rows = con.execute("SELECT id FROM devices WHERE site_id=?", (site_id,)).fetchall()
    seed = {int(r["id"]) for r in rows}
    if not seed:
        return {"updated": 0, "note": "No seed devices in this site yet."}

    # BFS from seeds, tagging only unassigned devices
    visited = set(seed)
    queue = list(seed)
    to_assign = []
    while queue:
        cur = queue.pop(0)
        for nb in adj.get(cur, []):
            if nb in visited: 
                continue
            visited.add(nb)
            # If this neighbor has no site yet, mark for assignment and continue BFS
            r = con.execute("SELECT site_id FROM devices WHERE id=?", (nb,)).fetchone()
            if not r:
                continue
            if r["site_id"] is None:
                to_assign.append(nb)
                queue.append(nb)
            else:
                # If already belongs to some site, we do not override.
                continue

    if to_assign:
        qmarks = ",".join(["?"]*len(to_assign))
        con.execute(f"UPDATE devices SET site_id=? WHERE id IN ({qmarks})", (site_id, *to_assign))
        con.commit()
    return {"updated": len(to_assign)}
