import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/unifi", tags=["unifi"])


# ---------------------------
# UniFi API client wrapper
# ---------------------------
class UniFiClient:
    def __init__(self, url: str, username: str, password: str, site: str = "default"):
        self.url = url.rstrip("/")
        self.username = username
        self.password = password
        self.site = site
        self.session: Optional[aiohttp.ClientSession] = None
        self.is_logged_in = False

    async def login(self):
        if self.session is None:
            self.session = aiohttp.ClientSession(cookie_jar=aiohttp.CookieJar())

        login_url = f"{self.url}/api/login"
        payload = {"username": self.username, "password": self.password}

        async with self.session.post(login_url, json=payload, ssl=False) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=resp.status, detail="Failed to login to UniFi Controller")
            self.is_logged_in = True

    async def get_devices(self) -> Dict[str, Any]:
        if not self.is_logged_in:
            await self.login()

        devices_url = f"{self.url}/api/s/{self.site}/stat/device"
        async with self.session.get(devices_url, ssl=False) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=resp.status, detail="Failed to fetch devices")
            return await resp.json()

    async def logout(self):
        if self.session:
            await self.session.close()
            self.session = None
            self.is_logged_in = False


# ---------------------------
# API Models
# ---------------------------
class UniFiConfig(BaseModel):
    url: str
    username: str
    password: str
    site: str = "default"


# ---------------------------
# FastAPI Routes
# ---------------------------
@router.post("/connect")
async def connect_to_unifi(config: UniFiConfig):
    """
    Connects to a UniFi Controller and tests login.
    """
    client = UniFiClient(config.url, config.username, config.password, config.site)
    await client.login()
    await client.logout()
    return {"status": "ok", "site": config.site}


@router.post("/devices")
async def get_unifi_devices(config: UniFiConfig):
    """
    Logs in, fetches devices from UniFi, logs out.
    """
    client = UniFiClient(config.url, config.username, config.password, config.site)
    await client.login()
    devices = await client.get_devices()
    await client.logout()
    return devices
