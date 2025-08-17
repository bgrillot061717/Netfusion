from .bootstrap_admin import ensure_admin
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import router as auth_router
from .users import router as users_router
from .maps_api import router as maps_router
from .endpoints_api import router as endpoints_router
from .snmp_scan_api import router as snmp_router
from .bootstrap_admin import ensure_admin
from .sites_api import router as sites_router
from .devices_api import router as devices_router
from . import unifi_api   # <--- add this

app = FastAPI()

# Ensure there is always an admin user on startup
ensure_admin()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Backend OK"}

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(maps_router)
app.include_router(endpoints_router)
app.include_router(snmp_router)
app.include_router(sites_router)
app.include_router(devices_router)
app.include_router(unifi_api.router)   # <--- add this