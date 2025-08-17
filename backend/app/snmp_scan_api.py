from ipaddress import ip_network
from typing import List, Dict
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from pysnmp.hlapi import SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity, getCmd
from .auth import require_min_role

router = APIRouter(prefix="/api/snmp", tags=["snmp"])

class ScanIn(BaseModel):
  cidr: str
  community: str
  timeout_ms: int | None = 500
  max_hosts: int | None = 256  # safety cap
  oids: List[str] | None = None  # optional, defaults to sysName/sysDescr

def _snmp_get(ip: str, community: str, timeout_ms: int, oids: List[str]) -> Dict:
  try:
    errorIndication, errorStatus, errorIndex, varBinds = next(
      getCmd(
        SnmpEngine(),
        CommunityData(community, mpModel=1),  # v2c
        UdpTransportTarget((ip, 161), timeout=timeout_ms/1000.0, retries=0),
        ContextData(),
        *[ObjectType(ObjectIdentity(oid)) for oid in oids]
      )
    )
    if errorIndication or errorStatus:
      return {"ok": False, "ip": ip}
    values = {}
    for vb in varBinds:
      oid = str(vb[0]); val = str(vb[1])
      values[oid] = val
    return {"ok": True, "ip": ip, "values": values}
  except Exception:
    return {"ok": False, "ip": ip}

@router.post("/scan")
def snmp_scan(body: ScanIn, user = Depends(require_min_role("admin"))):
  try:
    net = ip_network(body.cidr, strict=False)
  except Exception:
    raise HTTPException(400, "Invalid CIDR")
  hosts = [str(h) for h in net.hosts()]
  if body.max_hosts and len(hosts) > body.max_hosts:
    hosts = hosts[:body.max_hosts]
  oids = body.oids or ["1.3.6.1.2.1.1.5.0","1.3.6.1.2.1.1.1.0"]  # sysName.0, sysDescr.0
  timeout_ms = body.timeout_ms or 500
  results = []
  for ip in hosts:
    r = _snmp_get(ip, body.community, timeout_ms, oids)
    if r["ok"]:
      results.append(r)
  return {"count": len(results), "results": results}
